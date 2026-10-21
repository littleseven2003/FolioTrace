import { createHash } from 'node:crypto'
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectMetadata } from '../../src/domain/project-metadata'
import { classifyProjectFile } from '../../src/main/services/project-classification'
import {
  ProjectMetadataStore,
  type AuthorizedRoot
} from '../../src/main/services/project-metadata-store'
import type { ClassifyFileOutcome } from '../../src/shared/files'
import type { FolioError, Result } from '../../src/shared/result'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.()
  }
})

async function createProjectRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'folio-classify-')))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  return root
}

async function authorizedRoot(rootPath: string): Promise<AuthorizedRoot> {
  const stats = await lstat(rootPath)
  return {
    rootPath: await realpath(rootPath),
    identity: { dev: stats.dev, ino: stats.ino }
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function writeProjectJson(root: string, project: ProjectMetadata): Promise<string> {
  const directory = join(root, '.docwork')
  await mkdir(directory, { recursive: true })
  const file = join(directory, 'project.json')
  await writeFile(file, `${JSON.stringify(project, null, 2)}\n`, 'utf8')
  return file
}

function seededProject(notesSha: string): ProjectMetadata {
  return {
    schemaVersion: 1,
    projectId: 'project-seed',
    name: '已有项目',
    revision: 4,
    files: [{ id: 'file-ref', relativePath: 'notes.md', role: 'reference', sha256: notesSha }],
    documents: [{ id: 'doc-1', name: '季度报告', currentVersionId: null }],
    versions: [],
    relations: [],
    tasks: [],
    importedEvents: [
      { eventId: 'event-1', sha256: 'a'.repeat(64), importedAt: '2026-10-20T00:00:00.000Z' }
    ]
  }
}

function expectFailure(result: Result<unknown>): FolioError {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('预期调用失败')
  return result.error
}

function expectSuccess(result: Result<ClassifyFileOutcome>): ClassifyFileOutcome {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(`预期成功，实际 ${result.error.code}`)
  return result.value
}

describe('classifyProjectFile', () => {
  it('未初始化项目拒绝保存用途，且不创建 .docwork', async () => {
    const root = await createProjectRoot()
    await writeFile(join(root, 'report.docx'), 'demo')
    const store = new ProjectMetadataStore()

    const result = await classifyProjectFile(
      await authorizedRoot(root),
      { relativePath: 'report.docx', role: 'output', expectedRevision: 1 },
      store
    )

    expect(expectFailure(result).code).toBe('PROJECT_NOT_INITIALIZED')
    await expect(access(join(root, '.docwork'))).rejects.toThrow()
  })

  it('首次登记生成稳定 ID 与真实 SHA-256，并原子写入', async () => {
    const root = await createProjectRoot()
    const content = '季度目标：完成 M2 分类。'
    await writeFile(join(root, '报告.md'), content)
    const store = new ProjectMetadataStore()
    const authorized = await authorizedRoot(root)
    await store.initializeProject(authorized)

    const outcome = expectSuccess(
      await classifyProjectFile(
        authorized,
        { relativePath: '报告.md', role: 'reference', expectedRevision: 1 },
        store
      )
    )

    expect(outcome.revision).toBe(2)
    expect(outcome.contentChanged).toBe(false)
    expect(outcome.file.id).toMatch(/^file-[0-9a-f-]{36}$/)
    expect(outcome.file.relativePath).toBe('报告.md')
    expect(outcome.file.role).toBe('reference')
    expect(outcome.file.sha256).toBe(sha256(content))

    const onDisk = JSON.parse(
      await readFile(join(root, '.docwork', 'project.json'), 'utf8')
    ) as ProjectMetadata
    expect(onDisk.revision).toBe(2)
    expect(onDisk.files).toEqual([outcome.file])
  })

  it('重新打开后读取已保存用途，且重复保存保留 ID 与指纹', async () => {
    const root = await createProjectRoot()
    const content = 'v1'
    await writeFile(join(root, 'notes.md'), content)
    const store = new ProjectMetadataStore()
    const authorized = await authorizedRoot(root)
    await store.initializeProject(authorized)

    const first = expectSuccess(
      await classifyProjectFile(
        authorized,
        { relativePath: 'notes.md', role: 'process', expectedRevision: 1 },
        store
      )
    )
    const second = expectSuccess(
      await classifyProjectFile(
        authorized,
        { relativePath: 'notes.md', role: 'output', expectedRevision: 2 },
        store
      )
    )

    expect(second.file.id).toBe(first.file.id)
    expect(second.file.sha256).toBe(first.file.sha256)
    expect(second.file.role).toBe('output')
    expect(second.revision).toBe(3)

    const reopenedStore = new ProjectMetadataStore()
    const state = await reopenedStore.getState(authorized)
    expect(state.ok).toBe(true)
    if (!state.ok) return
    expect(state.value).toEqual({
      status: 'loaded',
      summary: {
        projectId: expect.any(String),
        name: expect.any(String),
        revision: 3,
        schemaVersion: 1,
        fileCount: 1,
        documentCount: 0,
        versionCount: 0,
        relationCount: 0
      },
      files: [second.file]
    })
  })

  it('修改已有记录用途时保留 ID、指纹与关联数据', async () => {
    const root = await createProjectRoot()
    const content = '# notes'
    await writeFile(join(root, 'notes.md'), content)
    const projectFile = await writeProjectJson(root, seededProject(sha256(content)))
    const before = await readFile(projectFile, 'utf8')
    const store = new ProjectMetadataStore()

    const outcome = expectSuccess(
      await classifyProjectFile(
        await authorizedRoot(root),
        { relativePath: 'notes.md', role: 'output', expectedRevision: 4 },
        store
      )
    )

    expect(outcome.revision).toBe(5)
    expect(outcome.contentChanged).toBe(false)
    expect(outcome.file).toEqual({
      id: 'file-ref',
      relativePath: 'notes.md',
      role: 'output',
      sha256: sha256(content)
    })

    const after = JSON.parse(await readFile(projectFile, 'utf8')) as ProjectMetadata
    expect(after.revision).toBe(5)
    expect(after.documents).toEqual([{ id: 'doc-1', name: '季度报告', currentVersionId: null }])
    expect(after.importedEvents).toHaveLength(1)
    expect(after.files).toEqual([outcome.file])
    expect(before).not.toBe(await readFile(projectFile, 'utf8'))
  })

  it('内容变化时保留原指纹并标记 contentChanged，不掩盖漂移', async () => {
    const root = await createProjectRoot()
    const oldSha = sha256('old')
    await writeFile(join(root, 'notes.md'), 'new content')
    const projectFile = await writeProjectJson(root, seededProject(oldSha))
    const store = new ProjectMetadataStore()

    const outcome = expectSuccess(
      await classifyProjectFile(
        await authorizedRoot(root),
        { relativePath: 'notes.md', role: 'process', expectedRevision: 4 },
        store
      )
    )

    expect(outcome.contentChanged).toBe(true)
    expect(outcome.file.role).toBe('process')
    expect(outcome.file.sha256).toBe(oldSha)

    const after = JSON.parse(await readFile(projectFile, 'utf8')) as ProjectMetadata
    expect(after.files[0]?.sha256).toBe(oldSha)
    expect(after.revision).toBe(5)
  })

  it('拒绝越界、内部目录、绝对路径与符号链接，且不修改元数据', async () => {
    const root = await createProjectRoot()
    const outside = await createProjectRoot()
    await writeFile(join(root, 'notes.md'), 'notes')
    await writeFile(join(outside, 'secret.md'), 'secret')
    await symlink(join(outside, 'secret.md'), join(root, 'link.md'))
    await mkdir(join(root, 'folder'))
    await mkdir(join(root, '.git'))
    await writeFile(join(root, '.git', 'config'), 'x')
    const store = new ProjectMetadataStore()
    const authorized = await authorizedRoot(root)
    await store.initializeProject(authorized)
    const projectFile = join(root, '.docwork', 'project.json')
    const before = await readFile(projectFile, 'utf8')

    const invalidPaths: Array<[string, string]> = [
      ['../secret.md', 'INVALID_PROJECT_PATH'],
      [join(outside, 'secret.md'), 'INVALID_PROJECT_PATH'],
      ['notes.md\\..\\x', 'INVALID_PROJECT_PATH'],
      ['.docwork/project.json', 'INVALID_PROJECT_PATH'],
      ['.git/config', 'INVALID_PROJECT_PATH'],
      ['folder', 'FILE_NOT_FOUND'],
      ['missing.md', 'FILE_NOT_FOUND'],
      ['link.md', 'FILE_NOT_FOUND']
    ]

    for (const [relativePath, code] of invalidPaths) {
      const result = await classifyProjectFile(
        authorized,
        { relativePath, role: 'reference', expectedRevision: 1 },
        store
      )
      expect(expectFailure(result).code, relativePath).toBe(code)
    }

    expect(await readFile(projectFile, 'utf8')).toBe(before)
  })

  it('expectedRevision 过期时返回冲突且不覆盖', async () => {
    const root = await createProjectRoot()
    const content = '# notes'
    await writeFile(join(root, 'notes.md'), content)
    const projectFile = await writeProjectJson(root, seededProject(sha256(content)))
    const before = await readFile(projectFile, 'utf8')
    const store = new ProjectMetadataStore()

    const result = await classifyProjectFile(
      await authorizedRoot(root),
      { relativePath: 'notes.md', role: 'output', expectedRevision: 3 },
      store
    )

    expect(expectFailure(result).code).toBe('REVISION_CONFLICT')
    expect(await readFile(projectFile, 'utf8')).toBe(before)
  })

  it('非法参数被拒绝，未初始化与授权失效分别返回稳定错误码', async () => {
    const root = await createProjectRoot()
    await writeFile(join(root, 'notes.md'), '# notes')
    const store = new ProjectMetadataStore()
    const authorized = await authorizedRoot(root)
    await store.initializeProject(authorized)

    for (const input of [null, 'bad', { relativePath: 'notes.md', role: 'boss', expectedRevision: 1 }]) {
      const result = await classifyProjectFile(authorized, input, store)
      expect(expectFailure(result).code).toBe('INVALID_CLASSIFICATION')
    }

    const badRevision = await classifyProjectFile(
      authorized,
      { relativePath: 'notes.md', role: 'output', expectedRevision: 0 },
      store
    )
    expect(expectFailure(badRevision).code).toBe('INVALID_CLASSIFICATION')
  })

  it('授权根被替换后拒绝保存，且不触碰根外内容', async () => {
    const root = await createProjectRoot()
    await writeFile(join(root, 'notes.md'), '# notes')
    const store = new ProjectMetadataStore()
    const authorized = await authorizedRoot(root)
    await store.initializeProject(authorized)
    const movedRoot = `${root}-moved`
    cleanups.push(() => rm(movedRoot, { recursive: true, force: true }))
    const movedProject = await readFile(join(root, '.docwork', 'project.json'), 'utf8')

    await rename(root, movedRoot)
    await mkdir(root)
    await writeFile(join(root, 'notes.md'), '# replaced')

    const result = await classifyProjectFile(
      authorized,
      { relativePath: 'notes.md', role: 'output', expectedRevision: 1 },
      store
    )

    expect(expectFailure(result).code).toBe('ROOT_IDENTITY_MISMATCH')
    await expect(access(join(root, '.docwork'))).rejects.toThrow()
    expect(await readFile(join(movedRoot, '.docwork', 'project.json'), 'utf8')).toBe(movedProject)
  })
})
