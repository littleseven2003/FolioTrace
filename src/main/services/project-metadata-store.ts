import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { hostname } from 'node:os'
import { basename, join, sep } from 'node:path'
import {
  createInitialProjectMetadata,
  type ProjectMetadata
} from '../../domain/project-metadata'
import type {
  InitializeProjectOutcome,
  ProjectMetadataState,
  ProjectMetadataSummary
} from '../../shared/files'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'
import type { FileIdentity } from './file-scanner'
import { validateProjectMetadata } from './project-schema-validator'

const MANAGEMENT_DIRECTORY = '.docwork'
const METADATA_FILE = 'project.json'
const LOCK_FILE = 'project.lock'
const MAX_METADATA_BYTES = 1024 * 1024

/** 授权时记录的根路径与 dev/ino；所有元数据操作都必须携带并复核。 */
export interface AuthorizedRoot {
  rootPath: string
  identity: FileIdentity
}

interface ProjectPaths {
  directory: string
  metadataFile: string
  lockFile: string
}

interface LockInfo {
  pid: number
  hostname: string
  createdAt: string
}

export type LoadProjectResult = { status: 'none' } | { status: 'loaded'; project: ProjectMetadata }

function pathsFor(rootPath: string): ProjectPaths {
  const directory = join(rootPath, MANAGEMENT_DIRECTORY)
  return {
    directory,
    metadataFile: join(directory, METADATA_FILE),
    lockFile: join(directory, LOCK_FILE)
  }
}

function summarize(project: ProjectMetadata): ProjectMetadataSummary {
  return {
    projectId: project.projectId,
    name: project.name,
    revision: project.revision,
    schemaVersion: 1,
    fileCount: project.files.length,
    documentCount: project.documents.length,
    versionCount: project.versions.length,
    relationCount: project.relations.length
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

function isPermissionError(error: unknown): boolean {
  const code = errorCode(error)
  return code === 'EACCES' || code === 'EPERM'
}

function pathsEqual(left: string, right: string): boolean {
  return left === right
}

/**
 * 任何元数据读写前的强制门禁：根路径必须仍是授权时的同一目录。
 * - 最终组件是符号链接 → 拒绝
 * - dev/ino 与授权时不同（换成另一个普通目录）→ 拒绝
 * - realpath 与授权时的 canonical 路径不同（祖先被替换）→ 拒绝
 */
async function checkAuthorizedRoot(root: AuthorizedRoot): Promise<Result<void>> {
  let stats
  try {
    stats = await lstat(root.rootPath)
  } catch {
    return fail('ROOT_IDENTITY_MISMATCH', ERROR_MESSAGES.rootIdentityMismatch)
  }

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    return fail('ROOT_IDENTITY_MISMATCH', ERROR_MESSAGES.rootIdentityMismatch)
  }

  if (stats.dev !== root.identity.dev || stats.ino !== root.identity.ino) {
    return fail('ROOT_IDENTITY_MISMATCH', ERROR_MESSAGES.rootIdentityMismatch)
  }

  try {
    const resolved = await realpath(root.rootPath)
    if (!pathsEqual(resolved, root.rootPath)) {
      return fail('ROOT_IDENTITY_MISMATCH', ERROR_MESSAGES.rootIdentityMismatch)
    }
  } catch {
    return fail('ROOT_IDENTITY_MISMATCH', ERROR_MESSAGES.rootIdentityMismatch)
  }

  return ok(undefined)
}

async function syncDirectory(directory: string): Promise<void> {
  let handle
  try {
    handle = await open(directory, 'r')
    await handle.sync()
  } catch (error) {
    const code = errorCode(error)
    // 部分文件系统不支持目录 fsync；rename 已保证原子性，忽略不支持错误。
    if (code && ['EINVAL', 'ENOTSUP', 'EISDIR', 'EBADF'].includes(code)) return
    throw error
  } finally {
    await handle?.close()
  }
}

async function validateManagementDirectory(directory: string): Promise<Result<void>> {
  let directoryStats
  try {
    directoryStats = await lstat(directory)
  } catch (error) {
    return fail(
      isPermissionError(error) ? 'PERMISSION_DENIED' : 'PATH_OUTSIDE_ROOT',
      isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.managementSymlink
    )
  }

  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
    return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.managementSymlink)
  }

  try {
    const resolved = await realpath(directory)
    if (!pathsEqual(resolved, directory)) {
      return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.managementSymlink)
    }
  } catch (error) {
    return fail(
      isPermissionError(error) ? 'PERMISSION_DENIED' : 'PATH_OUTSIDE_ROOT',
      isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.managementSymlink
    )
  }

  return ok(undefined)
}

async function ensureManagementDirectory(root: AuthorizedRoot): Promise<Result<ProjectPaths>> {
  const rootCheck = await checkAuthorizedRoot(root)
  if (!rootCheck.ok) return rootCheck
  const paths = pathsFor(root.rootPath)

  let directoryStats
  try {
    directoryStats = await lstat(paths.directory)
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      return fail(
        isPermissionError(error) ? 'PERMISSION_DENIED' : 'INTERNAL_ERROR',
        isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.metadataWriteFailed
      )
    }

    // 真正 mkdir 前再次复核根身份，避免用启动时的旧结果直接写盘。
    const beforeMkdir = await checkAuthorizedRoot(root)
    if (!beforeMkdir.ok) return beforeMkdir

    try {
      await mkdir(paths.directory, { mode: 0o700 })
    } catch (mkdirError) {
      return fail(
        isPermissionError(mkdirError) ? 'PERMISSION_DENIED' : 'INTERNAL_ERROR',
        isPermissionError(mkdirError)
          ? ERROR_MESSAGES.permissionDenied
          : ERROR_MESSAGES.metadataWriteFailed
      )
    }

    const afterMkdir = await checkAuthorizedRoot(root)
    if (!afterMkdir.ok) return afterMkdir
  }

  void directoryStats
  const directoryValidation = await validateManagementDirectory(paths.directory)
  if (!directoryValidation.ok) return directoryValidation

  const finalRootCheck = await checkAuthorizedRoot(root)
  if (!finalRootCheck.ok) return finalRootCheck

  return ok(paths)
}

async function readMetadataFile(
  root: AuthorizedRoot,
  paths: ProjectPaths
): Promise<Result<LoadProjectResult>> {
  const rootCheck = await checkAuthorizedRoot(root)
  if (!rootCheck.ok) return rootCheck

  let fileStats
  try {
    fileStats = await lstat(paths.metadataFile)
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return ok({ status: 'none' })
    return fail(
      isPermissionError(error) ? 'PERMISSION_DENIED' : 'PROJECT_METADATA_INVALID',
      isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.metadataInvalid
    )
  }

  if (fileStats.isSymbolicLink()) {
    return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.managementSymlink)
  }
  if (!fileStats.isFile()) {
    return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
  }

  let content: string
  let handle
  try {
    handle = await open(paths.metadataFile, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stats = await handle.stat()
    if (!stats.isFile() || stats.size > MAX_METADATA_BYTES) {
      return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
    }
    content = await handle.readFile('utf8')
  } catch (error) {
    return fail(
      isPermissionError(error) ? 'PERMISSION_DENIED' : 'PROJECT_METADATA_INVALID',
      isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.metadataInvalid
    )
  } finally {
    await handle?.close()
  }

  const afterRead = await checkAuthorizedRoot(root)
  if (!afterRead.ok) return afterRead
  const directoryValidation = await validateManagementDirectory(paths.directory)
  if (!directoryValidation.ok) return directoryValidation

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
  }

  const schemaVersion = (parsed as { schemaVersion?: unknown }).schemaVersion
  if (typeof schemaVersion !== 'number') {
    return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
  }
  if (schemaVersion > 1) {
    return fail('UNSUPPORTED_SCHEMA', ERROR_MESSAGES.metadataUnsupported)
  }
  if (schemaVersion !== 1) {
    return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
  }

  if (!validateProjectMetadata(parsed)) {
    return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
  }

  return ok({ status: 'loaded', project: parsed })
}

async function acquireLock(root: AuthorizedRoot, paths: ProjectPaths): Promise<Result<void>> {
  const rootCheck = await checkAuthorizedRoot(root)
  if (!rootCheck.ok) return rootCheck

  const lockInfo: LockInfo = {
    pid: process.pid,
    hostname: hostname(),
    createdAt: new Date().toISOString()
  }

  const attempt = async (): Promise<Result<void>> => {
    let handle
    try {
      handle = await open(paths.lockFile, 'wx', 0o600)
      await handle.writeFile(JSON.stringify(lockInfo), 'utf8')
      await handle.sync()
      return ok(undefined)
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') {
        return fail(
          isPermissionError(error) ? 'PERMISSION_DENIED' : 'INTERNAL_ERROR',
          isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.metadataWriteFailed
        )
      }

      const stale = await isStaleLock(paths.lockFile)
      if (stale) {
        // 删除陈旧锁前再次确认根身份，避免在已替换的根外删除内容。
        const beforeUnlink = await checkAuthorizedRoot(root)
        if (!beforeUnlink.ok) return beforeUnlink
        try {
          await unlink(paths.lockFile)
        } catch {
          return fail('PROJECT_LOCKED', ERROR_MESSAGES.projectLocked)
        }
        return attempt()
      }
      return fail('PROJECT_LOCKED', ERROR_MESSAGES.projectLocked)
    } finally {
      await handle?.close()
    }
  }

  return attempt()
}

async function isStaleLock(lockFile: string): Promise<boolean> {
  let raw: string
  try {
    raw = await readFile(lockFile, 'utf8')
  } catch {
    return false
  }

  let info: unknown
  try {
    info = JSON.parse(raw)
  } catch {
    return false
  }

  if (typeof info !== 'object' || info === null) return false
  const { pid, hostname: lockHost } = info as { pid?: unknown; hostname?: unknown }
  if (typeof pid !== 'number' || typeof lockHost !== 'string') return false
  if (lockHost !== hostname()) return false

  try {
    process.kill(pid, 0)
    return false
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH'
  }
}

async function releaseLock(root: AuthorizedRoot, paths: ProjectPaths): Promise<void> {
  // 根身份已变化时不再删除锁文件，避免误删根外内容；宁可留下锁文件。
  const rootCheck = await checkAuthorizedRoot(root)
  if (!rootCheck.ok) return

  try {
    await unlink(paths.lockFile)
  } catch {
    // 锁可能已被清理；释放失败不覆盖主流程错误。
  }
}

async function writeMetadataAtomically(
  root: AuthorizedRoot,
  paths: ProjectPaths,
  project: ProjectMetadata
): Promise<Result<ProjectMetadata>> {
  const beforeWrite = await checkAuthorizedRoot(root)
  if (!beforeWrite.ok) return beforeWrite

  const tempPath = join(paths.directory, `.project-${randomUUID()}.tmp`)
  let handle
  let renamed = false

  try {
    handle = await open(tempPath, 'wx', 0o600)
    await handle.writeFile(`${JSON.stringify(project, null, 2)}\n`, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined

    const tempReal = await realpath(tempPath)
    if (!tempReal.startsWith(`${paths.directory}${sep}`)) {
      return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.managementSymlink)
    }

    let targetStats
    try {
      targetStats = await lstat(paths.metadataFile)
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error
    }
    if (targetStats?.isSymbolicLink()) {
      return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.managementSymlink)
    }

    const directoryValidation = await validateManagementDirectory(paths.directory)
    if (!directoryValidation.ok) return directoryValidation

    // rename 前最后复核根身份与授权目录。
    const beforeRename = await checkAuthorizedRoot(root)
    if (!beforeRename.ok) return beforeRename

    await rename(tempPath, paths.metadataFile)
    renamed = true
    await syncDirectory(paths.directory)
    return ok(project)
  } catch (error) {
    return fail(
      isPermissionError(error) ? 'PERMISSION_DENIED' : 'INTERNAL_ERROR',
      isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.metadataWriteFailed
    )
  } finally {
    await handle?.close()
    if (!renamed) {
      const stillAuthorized = await checkAuthorizedRoot(root)
      if (stillAuthorized.ok) {
        try {
          await unlink(tempPath)
        } catch {
          // 清理临时文件失败不改变主结果。
        }
      }
    }
  }
}

/** 项目元数据唯一写入入口：schema 校验、原子 rename、lockfile 单写者。 */
export class ProjectMetadataStore {
  async loadProject(root: AuthorizedRoot): Promise<Result<LoadProjectResult>> {
    const paths = pathsFor(root.rootPath)
    const rootCheck = await checkAuthorizedRoot(root)
    if (!rootCheck.ok) return rootCheck

    let directoryStats
    try {
      directoryStats = await lstat(paths.directory)
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return ok({ status: 'none' })
      return fail(
        isPermissionError(error) ? 'PERMISSION_DENIED' : 'PATH_OUTSIDE_ROOT',
        isPermissionError(error) ? ERROR_MESSAGES.permissionDenied : ERROR_MESSAGES.managementSymlink
      )
    }

    if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
      return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.managementSymlink)
    }

    const afterDirectoryCheck = await checkAuthorizedRoot(root)
    if (!afterDirectoryCheck.ok) return afterDirectoryCheck

    const directoryValidation = await validateManagementDirectory(paths.directory)
    if (!directoryValidation.ok) return directoryValidation

    return readMetadataFile(root, paths)
  }

  async getState(root: AuthorizedRoot): Promise<Result<ProjectMetadataState>> {
    const loaded = await this.loadProject(root)
    if (!loaded.ok) return loaded
    if (loaded.value.status === 'none') return ok({ status: 'none' })
    return ok({ status: 'loaded', summary: summarize(loaded.value.project) })
  }

  /** 仅在用户主动点击初始化时调用；已有有效元数据时返回 existing，不覆盖。 */
  async initializeProject(root: AuthorizedRoot): Promise<Result<InitializeProjectOutcome>> {
    const existing = await this.loadProject(root)
    if (!existing.ok) return existing
    if (existing.value.status === 'loaded') {
      return ok({ status: 'existing', summary: summarize(existing.value.project) })
    }

    const ensured = await ensureManagementDirectory(root)
    if (!ensured.ok) return ensured
    const paths = ensured.value

    const locked = await acquireLock(root, paths)
    if (!locked.ok) return locked

    try {
      const recheck = await this.loadProject(root)
      if (!recheck.ok) return recheck
      if (recheck.value.status === 'loaded') {
        return ok({ status: 'existing', summary: summarize(recheck.value.project) })
      }

      const project = createInitialProjectMetadata({
        projectId: `project-${randomUUID()}`,
        name: basename(root.rootPath)
      })

      if (!validateProjectMetadata(project)) {
        return fail('INTERNAL_ERROR', ERROR_MESSAGES.metadataWriteFailed)
      }

      const written = await writeMetadataAtomically(root, paths, project)
      if (!written.ok) return written
      return ok({ status: 'created', summary: summarize(written.value) })
    } finally {
      await releaseLock(root, paths)
    }
  }

  /**
   * 原子写入新快照。expectedRevision=null 表示只允许创建；
   * 已有文件时必须匹配当前 revision，并写入 revision+1。
   * 当前 M2 暂未通过 IPC 暴露更新操作，此方法用于数据层约束与后续分类写回。
   */
  async writeProject(
    root: AuthorizedRoot,
    nextProject: ProjectMetadata,
    expectedRevision: number | null
  ): Promise<Result<ProjectMetadata>> {
    if (!validateProjectMetadata(nextProject)) {
      return fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid)
    }

    const ensured = await ensureManagementDirectory(root)
    if (!ensured.ok) return ensured
    const paths = ensured.value

    const locked = await acquireLock(root, paths)
    if (!locked.ok) return locked

    try {
      const current = await readMetadataFile(root, paths)
      if (!current.ok) return current

      if (current.value.status === 'none') {
        if (expectedRevision !== null) {
          return fail('REVISION_CONFLICT', ERROR_MESSAGES.revisionConflict)
        }
        return writeMetadataAtomically(root, paths, nextProject)
      }

      if (expectedRevision === null) {
        return fail('REVISION_CONFLICT', ERROR_MESSAGES.revisionConflict)
      }
      if (current.value.project.revision !== expectedRevision) {
        return fail('REVISION_CONFLICT', ERROR_MESSAGES.revisionConflict)
      }
      if (nextProject.revision !== expectedRevision + 1) {
        return fail('REVISION_CONFLICT', ERROR_MESSAGES.revisionConflict)
      }

      return writeMetadataAtomically(root, paths, nextProject)
    } finally {
      await releaseLock(root, paths)
    }
  }
}
