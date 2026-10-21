import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectMetadata } from '../../src/domain/project-metadata'
import {
  ProjectMetadataStore,
  type AuthorizedRoot
} from '../../src/main/services/project-metadata-store'
import { ERROR_MESSAGES } from '../../src/shared/result'

const tempRoots: string[] = []
const cleanups: Array<() => Promise<void>> = []

async function createTempRoot(prefix = 'folio-metadata-'): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  tempRoots.push(root)
  return root
}

async function authorizedRoot(rootPath: string): Promise<AuthorizedRoot> {
  const stats = await lstat(rootPath)
  return { rootPath, identity: { dev: stats.dev, ino: stats.ino } }
}

/** 递归记录内容哈希，用于证明被拒绝的操作没有在目标目录写入。 */
async function snapshotTree(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  async function walk(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
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

    const result = await store.initializeProject(await authorizedRoot(root))

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
    const first = await store.initializeProject(await authorizedRoot(root))
    if (!first.ok) throw new Error('首次初始化失败')
    const before = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    const second = await store.initializeProject(await authorizedRoot(root))
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
    const state = await reopened.getState(await authorizedRoot(root))

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
      },
      files: [
        {
          id: 'file-ref',
          relativePath: '参考.md',
          role: 'reference',
          sha256: 'a'.repeat(64)
        }
      ]
    })

    const loaded = await reopened.loadProject(await authorizedRoot(root))
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

    const result = await store.initializeProject(await authorizedRoot(root))
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

    const result = await store.initializeProject(await authorizedRoot(root))
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

    const result = await store.loadProject(await authorizedRoot(root))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PROJECT_METADATA_INVALID')
  })

  it('拒绝被符号链接替换的管理目录', async () => {
    const root = await createTempRoot()
    const outside = await createTempRoot('folio-outside-')
    await symlink(outside, join(root, '.docwork'))
    const store = new ProjectMetadataStore()

    const result = await store.initializeProject(await authorizedRoot(root))

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

    const result = await store.initializeProject(await authorizedRoot(root))
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

    const result = await store.initializeProject(await authorizedRoot(root))

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
      const result = await store.initializeProject(await authorizedRoot(root))
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
    const initialized = await store.initializeProject(await authorizedRoot(root))
    if (!initialized.ok) throw new Error('初始化失败')
    const original = await readMetadata(root)
    const before = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    const conflict = await store.writeProject(
      await authorizedRoot(root),
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
    const initialized = await store.initializeProject(await authorizedRoot(root))
    if (!initialized.ok) throw new Error('初始化失败')
    const original = await readMetadata(root)

    const written = await store.writeProject(
      await authorizedRoot(root),
      { ...original, revision: 2, name: '新名字' },
      1
    )

    expect(written.ok).toBe(true)
    const reread = await readMetadata(root)
    expect(reread.revision).toBe(2)
    expect(reread.name).toBe('新名字')
  })
})

describe('ProjectMetadataStore 授权根身份复核', () => {
  it('根目录被移走并替换为根外符号链接时拒绝，且不在根外创建任何内容', async () => {
    const base = await createTempRoot('folio-root-auth-')
    const root = join(base, 'project')
    await mkdir(root)
    await writeBusinessFiles(root)
    const authorized = await authorizedRoot(root)

    const movedRoot = join(base, 'moved-project')
    await rename(root, movedRoot)
    const outside = await createTempRoot('folio-outside-')
    await symlink(outside, root)

    const before = await snapshotTree(outside)
    const store = new ProjectMetadataStore()
    const loaded = await store.loadProject(authorized)
    const initialized = await store.initializeProject(authorized)
    const written = await store.writeProject(authorized, createSampleProject(), null)
    const after = await snapshotTree(outside)

    for (const result of [loaded, initialized, written]) {
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.code).toBe('ROOT_IDENTITY_MISMATCH')
      expect(result.error.message).toBe(ERROR_MESSAGES.rootIdentityMismatch)
    }
    expect(after).toEqual(before)
    await expect(lstat(join(outside, '.docwork'))).rejects.toThrow()
    await expect(lstat(join(movedRoot, '.docwork'))).rejects.toThrow()
  })

  it('根目录被换成另一个普通目录时拒绝，且不修改新目录', async () => {
    const base = await createTempRoot('folio-root-auth-')
    const root = join(base, 'project')
    await mkdir(root)
    await writeBusinessFiles(root)
    const authorized = await authorizedRoot(root)

    const movedRoot = join(base, 'moved-project')
    await rename(root, movedRoot)
    await mkdir(root)
    await writeFile(join(root, 'placeholder.txt'), 'unauthorized', 'utf8')
    const before = await snapshotTree(root)

    const store = new ProjectMetadataStore()
    const initialized = await store.initializeProject(authorized)
    const written = await store.writeProject(authorized, createSampleProject(), null)
    const after = await snapshotTree(root)

    for (const result of [initialized, written]) {
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.code).toBe('ROOT_IDENTITY_MISMATCH')
    }
    expect(after).toEqual(before)
    await expect(lstat(join(root, '.docwork'))).rejects.toThrow()
    await expect(lstat(join(movedRoot, '.docwork'))).rejects.toThrow()
  })

  it('祖先目录被替换后根路径指向根外目录时拒绝，且根外目录保持不变', async () => {
    const base = await createTempRoot('folio-root-auth-')
    const authorizedParent = join(base, 'authorized-parent')
    const root = join(authorizedParent, 'project')
    await mkdir(root, { recursive: true })
    await writeBusinessFiles(root)
    const authorized = await authorizedRoot(root)

    const outsideParent = await createTempRoot('folio-outside-')
    await mkdir(join(outsideParent, 'project'))
    await writeFile(join(outsideParent, 'project', 'outside.txt'), 'outside', 'utf8')
    const before = await snapshotTree(outsideParent)

    await rename(authorizedParent, join(base, 'original-parent'))
    await symlink(outsideParent, authorizedParent)

    const store = new ProjectMetadataStore()
    const initialized = await store.initializeProject(authorized)
    const after = await snapshotTree(outsideParent)

    expect(initialized.ok).toBe(false)
    if (initialized.ok) return
    expect(initialized.error.code).toBe('ROOT_IDENTITY_MISMATCH')
    expect(after).toEqual(before)
    await expect(lstat(join(outsideParent, 'project', '.docwork'))).rejects.toThrow()
  })
})
