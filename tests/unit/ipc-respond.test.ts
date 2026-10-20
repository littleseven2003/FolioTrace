import { describe, expect, it, vi } from 'vitest'
import { respondProjectSnapshot, respondRuntimeInfo } from '../../src/main/ipc/respond'
import { createTrustedRenderer, type IpcCaller } from '../../src/main/ipc/trust'
import { MockProjectRepository } from '../../src/main/services/mock-repository'
import type { ProjectRepository } from '../../src/main/services/project-repository'
import type { RuntimeInfo } from '../../src/shared/ipc'
import { ERROR_MESSAGES } from '../../src/shared/result'

const PRODUCTION_ENTRY_PATH = '/opt/FolioTrace/out/renderer/index.html'
const PRODUCTION_ENTRY_URL = 'file:///opt/FolioTrace/out/renderer/index.html'
const trusted = createTrustedRenderer({
  webContentsId: 7,
  frameProcessId: 42,
  frameRoutingId: 3,
  devServerUrl: null,
  productionEntryPath: PRODUCTION_ENTRY_PATH
})
const caller: IpcCaller = {
  webContentsId: 7,
  frameProcessId: 42,
  frameRoutingId: 3,
  frameUrl: PRODUCTION_ENTRY_URL
}

const runtime: RuntimeInfo = {
  appName: '文脉 / FolioTrace',
  appVersion: '0.0.0',
  electronVersion: '44.9.0',
  chromeVersion: '152.0.0'
}

describe('respondProjectSnapshot', () => {
  it('可信调用返回项目快照', () => {
    const result = respondProjectSnapshot(caller, trusted, new MockProjectRepository())

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('预期成功')
    expect(result.value.materials).toHaveLength(3)
    expect(result.value.projectName).toBe('年度成果汇报')
  })

  it('仓库异常时返回固定错误，不泄漏异常文本或堆栈', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const repository: ProjectRepository = {
      getSnapshot: () => {
        throw new Error('SECRET /Users/littleseven/private/renderer.ts')
      }
    }

    const result = respondProjectSnapshot(caller, trusted, repository)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('预期失败')
    expect(result.error.code).toBe('INTERNAL_ERROR')
    expect(result.error.message).toBe(ERROR_MESSAGES.snapshotUnavailable)
    expect(JSON.stringify(result)).not.toContain('SECRET')
    expect(JSON.stringify(result)).not.toContain('/Users/')
    expect(consoleError).toHaveBeenCalled()
  })

  it('其他窗口被拒绝，且不会读取仓库', () => {
    const repository = new MockProjectRepository()
    const getSnapshot = vi.spyOn(repository, 'getSnapshot')

    const result = respondProjectSnapshot({ ...caller, webContentsId: 8 }, trusted, repository)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('预期失败')
    expect(result.error.code).toBe('UNTRUSTED_SOURCE')
    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('子框架被拒绝', () => {
    const result = respondProjectSnapshot(
      { ...caller, frameRoutingId: 9 },
      trusted,
      new MockProjectRepository()
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('预期失败')
    expect(result.error.code).toBe('UNTRUSTED_SOURCE')
  })
})

describe('respondRuntimeInfo', () => {
  it('可信调用返回运行时信息', () => {
    expect(respondRuntimeInfo(caller, trusted, runtime)).toEqual({ ok: true, value: runtime })
  })

  it('不可信来源被拒绝', () => {
    const result = respondRuntimeInfo({ ...caller, frameUrl: 'https://example.com/' }, trusted, runtime)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('预期失败')
    expect(result.error.code).toBe('UNTRUSTED_SOURCE')
  })
})
