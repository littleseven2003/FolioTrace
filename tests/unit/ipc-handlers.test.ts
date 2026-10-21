import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerIpcHandlers } from '../../src/main/ipc/handlers'
import { createTrustedRenderer, type TrustedRenderer } from '../../src/main/ipc/trust'
import { MockProjectRepository } from '../../src/main/services/mock-repository'
import { ProjectMetadataStore } from '../../src/main/services/project-metadata-store'
import { ProjectRegistry } from '../../src/main/services/project-registry'
import type { InitializeProjectOutcome, ProjectScan } from '../../src/shared/files'
import { IPC_CHANNELS } from '../../src/shared/ipc'
import type { FolioError, Result } from '../../src/shared/result'

type IpcListener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

const captured = vi.hoisted(() => ({
  listeners: new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
}))

// 只替换 Electron 运行时；扫描、授权表、元数据存储都使用真实实现。
vi.mock('electron', () => ({
  app: { getVersion: () => '0.0.0' },
  BrowserWindow: { fromWebContents: () => null },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      captured.listeners.set(channel, listener)
    }
  }
}))

const TRUSTED: TrustedRenderer = createTrustedRenderer({
  webContentsId: 11,
  frameProcessId: 22,
  frameRoutingId: 2,
  devServerUrl: 'http://localhost:5173/',
  productionEntryPath: '/opt/FolioTrace/out/renderer/index.html'
})

const cleanups: Array<() => Promise<void>> = []

async function createTempDirectory(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'folio-ipc-handlers-')))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  return root
}

afterEach(async () => {
  captured.listeners.clear()
  while (cleanups.length > 0) {
    await cleanups.pop()?.()
  }
})

interface CallerOverrides {
  webContentsId?: number
  frameProcessId?: number | null
  frameRoutingId?: number | null
  frameUrl?: string
  noFrame?: boolean
}

function createEvent(overrides: CallerOverrides = {}): IpcMainInvokeEvent {
  return {
    sender: { id: overrides.webContentsId ?? TRUSTED.webContentsId },
    senderFrame: overrides.noFrame
      ? null
      : {
          processId: overrides.frameProcessId ?? TRUSTED.frameProcessId,
          routingId: overrides.frameRoutingId ?? TRUSTED.frameRoutingId,
          url: overrides.frameUrl ?? TRUSTED.entryUrl
        }
  } as unknown as IpcMainInvokeEvent
}

function setupIpc(): ProjectRegistry {
  captured.listeners.clear()
  const registry = new ProjectRegistry()
  registerIpcHandlers({
    repository: new MockProjectRepository(),
    projectRegistry: registry,
    metadataStore: new ProjectMetadataStore(),
    getTrustedRenderer: () => TRUSTED
  })
  return registry
}

async function invoke(
  channel: string,
  event: IpcMainInvokeEvent,
  ...args: unknown[]
): Promise<Result<unknown>> {
  const listener: IpcListener | undefined = captured.listeners.get(channel)
  if (!listener) throw new Error(`IPC 通道未注册：${channel}`)
  return (await listener(event, ...args)) as Result<unknown>
}

function expectFailure(result: Result<unknown>): FolioError {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('预期调用失败')
  return result.error
}

/** 已授权目录 + 真实文件；.git 应被忽略，绝对路径不应出现在结果中。 */
async function createAuthorizedProject(registry: ProjectRegistry): Promise<{
  root: string
  handle: string
}> {
  const root = await createTempDirectory()
  await mkdir(join(root, 'notes'))
  await mkdir(join(root, '.git'))
  await writeFile(join(root, 'report.docx'), 'demo')
  await writeFile(join(root, 'notes', 'plan.md'), '# plan')
  await writeFile(join(root, '.git', 'config'), 'ignored')

  const authorized = await registry.authorize(root)
  if (!authorized.ok) throw new Error(`授权失败：${authorized.error.code}`)
  return { root, handle: authorized.value.handle }
}

describe('files:scan handler', () => {
  it('已授权 handle 经 IPC 返回真实文件清单', async () => {
    const registry = setupIpc()
    const { root, handle } = await createAuthorizedProject(registry)

    const result = await invoke(IPC_CHANNELS.filesScan, createEvent(), handle)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const scan = result.value as ProjectScan
    expect(scan.handle).toBe(handle)
    expect(scan.files.map((file) => file.relativePath)).toEqual([
      'notes/plan.md',
      'report.docx'
    ])
    expect(scan.files.map((file) => file.category)).toEqual(['text', 'document'])
    expect(scan.files.every((file) => file.classification === 'unclassified')).toBe(true)
    expect(scan.warnings).toEqual([])
    // renderer 侧只能看到相对路径与 handle，不泄露绝对根目录。
    expect(JSON.stringify(scan)).not.toContain(root)
  })

  it('未知 handle 与绝对路径都被拒绝，不再依赖 renderer 传入路径', async () => {
    const registry = setupIpc()
    const { root } = await createAuthorizedProject(registry)

    const unknown = expectFailure(
      await invoke(IPC_CHANNELS.filesScan, createEvent(), 'project-does-not-exist')
    )
    expect(unknown.code).toBe('PROJECT_NOT_FOUND')

    // 回归点：把绝对路径当 handle 传入时必须仍是 PROJECT_NOT_FOUND，
    // 而不是“扫描服务拿路径才能工作、handle 反而失败”。
    const absolute = expectFailure(await invoke(IPC_CHANNELS.filesScan, createEvent(), root))
    expect(absolute.code).toBe('PROJECT_NOT_FOUND')
  })

  it('不可信调用方无法触发扫描', async () => {
    const registry = setupIpc()
    const { root, handle } = await createAuthorizedProject(registry)
    const untrustedCallers: CallerOverrides[] = [
      { webContentsId: TRUSTED.webContentsId + 1 },
      { frameRoutingId: TRUSTED.frameRoutingId + 1 },
      { frameProcessId: TRUSTED.frameProcessId + 1 },
      { frameUrl: 'https://example.com/' },
      { frameUrl: undefined, noFrame: true }
    ]

    for (const overrides of untrustedCallers) {
      const error = expectFailure(
        await invoke(IPC_CHANNELS.filesScan, createEvent(overrides), handle)
      )
      expect(error.code).toBe('UNTRUSTED_SOURCE')
    }

    // 可信调用方仍然能扫描，说明拒绝来自来源校验而非项目本身。
    const trusted = await invoke(IPC_CHANNELS.filesScan, createEvent(), handle)
    expect(trusted.ok).toBe(true)
    expect(root.length).toBeGreaterThan(0)
  })
})

describe('project:initialize handler', () => {
  it('授权根被替换后拒绝初始化，保留授权根身份校验', async () => {
    const registry = setupIpc()
    const { root, handle } = await createAuthorizedProject(registry)

    // 模拟授权后目录被移走、同路径换成新目录：写入必须被身份校验拦截。
    const movedRoot = `${root}-moved`
    cleanups.push(() => rm(movedRoot, { recursive: true, force: true }))
    await rename(root, movedRoot)
    await mkdir(root)
    await writeFile(join(root, 'outside.txt'), '不应被写入')

    const error = expectFailure(
      await invoke(IPC_CHANNELS.projectInitialize, createEvent(), handle)
    )
    expect(error.code).toBe('ROOT_IDENTITY_MISMATCH')
  })

  it('可信 handle 可完成初始化并读到摘要', async () => {
    const registry = setupIpc()
    const { handle } = await createAuthorizedProject(registry)

    const initialized = await invoke(IPC_CHANNELS.projectInitialize, createEvent(), handle)
    expect(initialized.ok).toBe(true)
    if (!initialized.ok) return
    const outcome = initialized.value as InitializeProjectOutcome
    expect(outcome.status).toBe('created')
    expect(outcome.summary.revision).toBe(1)

    const state = await invoke(IPC_CHANNELS.projectGetMetadata, createEvent(), handle)
    expect(state.ok).toBe(true)
    if (!state.ok) return
    expect(state.value).toMatchObject({ status: 'loaded' })
  })
})
