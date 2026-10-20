import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectMetadata } from '../../src/domain/project-metadata'
import { ProjectMetadataStore } from '../../src/main/services/project-metadata-store'
import { ERROR_MESSAGES } from '../../src/shared/result'

const tempRoots: string[] = []
const cleanups: Array<() => Promise<void>> = []

async function createTempRoot(prefix = 'folio-metadata-'): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.()
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root) await rm(root, { recursive: true, force: true })
  }
})

async function writeBusinessFiles(root: string): Promise<Map<string, string>> {
  await mkdir(join(root, '报告'), { recursive: true })
  await mkdir(join(root, '.git'), { recursive: true })
  await writeFile(join(root, '报告', '初稿.md'), '# 初稿', 'utf8')
  await writeFile(join(root, '.git', 'config'), 'git config', 'utf8')
  const result = new Map<string, string>()
  const files: Array<[string, string]> = [
    ['报告/初稿.md', '# 初稿'],
    ['.git/config', 'git config']
  ]
  for (const [relativePath, content] of files) {
    result.set(relativePath, createHash('sha256').update(content).digest('hex'))
  }
  return result
}

async function snapshotBusinessFiles(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  async function walk(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (relativePath === '.docwork' || relativePath.startsWith('.docwork/')) continue
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) await walk(absolutePath, relativePath)
      else if (entry.isFile()) {
        const content = await readFile(absolutePath)
        result.set(relativePath, createHash('sha256').update(content).digest('hex'))
      }
    }
  }
  await walk(root, '')
  return result
}

async function readMetadata(root: string): Promise<ProjectMetadata> {
  return JSON.parse(await readFile(join(root, '.docwork', 'project.json'), 'utf8')) as ProjectMetadata
}

async function writeMetadata(root: string, project: unknown): Promise<void> {
  await mkdir(join(root, '.docwork'), { recursive: true })
  await writeFile(join(root, '.docwork', 'project.json'), JSON.stringify(project), 'utf8')
}

function createSampleProject(): ProjectMetadata {
  return {
    schemaVersion: 1,
    projectId: 'project-existing',
    name: '已有项目',
    revision: 4,
    files: [
      {
        id: 'file-ref',
        relativePath: '参考.md',
        role: 'reference',
        sha256: 'a'.repeat(64)
      }
    ],
    documents: [{ id: 'doc-1', name: '汇报材料', currentVersionId: null }],
    versions: [],
    relations: [],
    tasks: [{ taskId: 'task-1', relativePath: '.docwork/tasks/task-1.json', status: 'awaiting-output' }],
    importedEvents: []
  }
}

describe('ProjectMetadataStore.initializeProject', () => {
  it('用户主动初始化后创建 schemaVersion=1、revision=1、集合为空的元数据', async () => {
    const root = await createTempRoot()
    const businessBefore = await writeBusinessFiles(root)
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(root)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('created')
    expect(result.value.summary.revision).toBe(1)

    const project = await readMetadata(root)
    expect(project.schemaVersion).toBe(1)
    expect(project.revision).toBe(1)
    expect(project.projectId).toMatch(/^project-/)
    expect(project.name).toBe(basename(root))
    expect(project.files).toEqual([])
    expect(project.documents).toEqual([])
    expect(project.versions).toEqual([])
    expect(project.tasks).toEqual([])
    expect(await snapshotBusinessFiles(root)).toEqual(businessBefore)
  })

  it('重复初始化不覆盖已有项目', async () => {
    const root = await createTempRoot()
    const store = new ProjectMetadataStore()
    const first = await store.initializeProject(root)
    if (!first.ok) throw new Error('首次初始化失败')
    const before = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    const second = await store.initializeProject(root)
    const after = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.status).toBe('existing')
    expect(second.value.summary.projectId).toBe(first.value.summary.projectId)
    expect(after).toBe(before)
  })

  it('重新打开同一目录可读取原有 ID、分类与其他数据', async () => {
    const root = await createTempRoot()
    const sample = createSampleProject()
    await writeMetadata(root, sample)

    const reopened = new ProjectMetadataStore()
    const state = await reopened.getState(root)

    expect(state.ok).toBe(true)
    if (!state.ok) return
    expect(state.value).toEqual({
      status: 'loaded',
      summary: {
        projectId: 'project-existing',
        name: '已有项目',
        revision: 4,
        schemaVersion: 1,
        fileCount: 1,
        documentCount: 1,
        versionCount: 0,
        relationCount: 0
      }
    })

    const loaded = await reopened.loadProject(root)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok || loaded.value.status !== 'loaded') return
    expect(loaded.value.project.files[0]).toMatchObject({
      id: 'file-ref',
      role: 'reference'
    })
    expect(loaded.value.project.documents[0]).toMatchObject({
      id: 'doc-1',
      currentVersionId: null
    })
  })

  it('已有 project.json 损坏时不覆盖重建', async () => {
    const root = await createTempRoot()
    await mkdir(join(root, '.docwork'))
    await writeFile(join(root, '.docwork', 'project.json'), '{ not-json', 'utf8')
    const before = await readFile(join(root, '.docwork', 'project.json'), 'utf8')
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(root)
    const after = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PROJECT_METADATA_INVALID')
    expect(result.error.message).toBe(ERROR_MESSAGES.metadataInvalid)
    expect(after).toBe(before)
  })

  it('不支持的 schemaVersion 给出提示且不覆盖', async () => {
    const root = await createTempRoot()
    await writeMetadata(root, { schemaVersion: 2, anything: true })
    const before = await readFile(join(root, '.docwork', 'project.json'), 'utf8')
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(root)
    const after = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('UNSUPPORTED_SCHEMA')
    expect(after).toBe(before)
  })

  it('不符合 schema 的元数据被拒绝', async () => {
    const root = await createTempRoot()
    await writeMetadata(root, { schemaVersion: 1, projectId: 'x' })
    const store = new ProjectMetadataStore()

    const result = await store.loadProject(root)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PROJECT_METADATA_INVALID')
  })

  it('拒绝被符号链接替换的管理目录', async () => {
    const root = await createTempRoot()
    const outside = await createTempRoot('folio-outside-')
    await symlink(outside, join(root, '.docwork'))
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(root)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PATH_OUTSIDE_ROOT')
    expect(result.error.message).toBe(ERROR_MESSAGES.managementSymlink)
    await expect(readFile(join(outside, 'project.json'), 'utf8')).rejects.toThrow()
  })

  it('拒绝被符号链接替换的 project.json', async () => {
    const root = await createTempRoot()
    const outside = await createTempRoot('folio-outside-')
    const outsideFile = join(outside, 'project.json')
    await writeFile(outsideFile, JSON.stringify(createSampleProject()), 'utf8')
    await mkdir(join(root, '.docwork'))
    await symlink(outsideFile, join(root, '.docwork', 'project.json'))
    const before = await readFile(outsideFile, 'utf8')
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(root)
    const after = await readFile(outsideFile, 'utf8')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PATH_OUTSIDE_ROOT')
    expect(after).toBe(before)
  })

  it('已有活动锁时拒绝初始化', async () => {
    const root = await createTempRoot()
    await mkdir(join(root, '.docwork'))
    await writeFile(
      join(root, '.docwork', 'project.lock'),
      JSON.stringify({ pid: process.pid, hostname: hostname(), createdAt: new Date().toISOString() }),
      'utf8'
    )
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(root)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PROJECT_LOCKED')
    expect(result.error.message).toBe(ERROR_MESSAGES.projectLocked)
  })

  it('写入失败时返回可读错误且不留下元数据', async () => {
    if (process.platform === 'win32') return
    const root = await createTempRoot()
    await mkdir(join(root, '.docwork'))
    await chmod(join(root, '.docwork'), 0o500)
    const store = new ProjectMetadataStore()

    try {
      const result = await store.initializeProject(root)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(['PERMISSION_DENIED', 'INTERNAL_ERROR']).toContain(result.error.code)
      await expect(readFile(join(root, '.docwork', 'project.json'), 'utf8')).rejects.toThrow()
    } finally {
      await chmod(join(root, '.docwork'), 0o700)
    }
  })
})

describe('ProjectMetadataStore.writeProject', () => {
  it('revision 冲突被拒绝且不修改文件', async () => {
    const root = await createTempRoot()
    const store = new ProjectMetadataStore()
    const initialized = await store.initializeProject(root)
    if (!initialized.ok) throw new Error('初始化失败')
    const original = await readMetadata(root)
    const before = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    const conflict = await store.writeProject(
      root,
      { ...original, revision: 2, name: '改名' },
      99
    )
    const after = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    expect(conflict.ok).toBe(false)
    if (conflict.ok) return
    expect(conflict.error.code).toBe('REVISION_CONFLICT')
    expect(after).toBe(before)
  })

  it('匹配 revision 后原子写入 revision+1', async () => {
    const root = await createTempRoot()
    const store = new ProjectMetadataStore()
    const initialized = await store.initializeProject(root)
    if (!initialized.ok) throw new Error('初始化失败')
    const original = await readMetadata(root)

    const written = await store.writeProject(
      root,
      { ...original, revision: 2, name: '新名字' },
      1
    )

    expect(written.ok).toBe(true)
    const reread = await readMetadata(root)
    expect(reread.revision).toBe(2)
    expect(reread.name).toBe('新名字')
  })
})
