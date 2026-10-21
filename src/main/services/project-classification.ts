import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { INTERNAL_DIRECTORY_NAMES, INTERNAL_FILE_NAMES } from '../../domain/file-scan'
import type { ProjectFileRecord, ProjectMetadata } from '../../domain/project-metadata'
import {
  FILE_ROLES,
  type ClassifyFileInput,
  type ClassifyFileOutcome,
  type FileRole
} from '../../shared/files'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'
import {
  checkAuthorizedRoot,
  type AuthorizedRoot,
  type ProjectMetadataStore
} from './project-metadata-store'

const MAX_RELATIVE_PATH_LENGTH = 1024

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

function isPermissionError(error: unknown): boolean {
  const code = errorCode(error)
  return code === 'EACCES' || code === 'EPERM'
}

function isFileRole(value: unknown): value is FileRole {
  return typeof value === 'string' && (FILE_ROLES as readonly string[]).includes(value)
}

/**
 * 只接受项目根内的相对路径：斜杠分隔、不含空段/`.`/`..`、反斜杠、盘符，
 * 且不指向扫描器会忽略的内部目录与系统临时文件。
 */
export function isSafeProjectRelativePath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_RELATIVE_PATH_LENGTH
  ) {
    return false
  }
  if (value.startsWith('/') || value.includes('\\') || value.includes('\0')) return false
  if (/^[A-Za-z]:/.test(value) || value.endsWith('/')) return false

  const segments = value.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') return false
    if (INTERNAL_DIRECTORY_NAMES.has(segment)) return false
  }

  return !INTERNAL_FILE_NAMES.has(segments[segments.length - 1] ?? '')
}

/** IPC 边界与数据层共用同一套输入校验，非法输入不进入读取或写入流程。 */
export function parseClassifyFileInput(input: unknown): Result<ClassifyFileInput> {
  if (typeof input !== 'object' || input === null) {
    return fail('INVALID_CLASSIFICATION', ERROR_MESSAGES.invalidClassification)
  }

  const { relativePath, role, expectedRevision } = input as {
    relativePath?: unknown
    role?: unknown
    expectedRevision?: unknown
  }

  if (!isSafeProjectRelativePath(relativePath)) {
    return fail('INVALID_PROJECT_PATH', ERROR_MESSAGES.invalidFileRelativePath)
  }
  if (!isFileRole(role)) {
    return fail('INVALID_CLASSIFICATION', ERROR_MESSAGES.invalidClassification)
  }
  if (
    typeof expectedRevision !== 'number' ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1
  ) {
    return fail('INVALID_CLASSIFICATION', ERROR_MESSAGES.invalidClassification)
  }

  return ok({ relativePath, role, expectedRevision })
}

function insideRoot(rootPath: string, candidate: string): boolean {
  return candidate.startsWith(`${rootPath}${sep}`)
}

function fingerprintFailure(error: unknown): Result<never> {
  const code = errorCode(error)
  if (isPermissionError(error)) {
    return fail('PERMISSION_DENIED', ERROR_MESSAGES.permissionDenied)
  }
  if (code === 'ENOENT' || code === 'ELOOP' || code === 'ENOTDIR') {
    return fail('FILE_NOT_FOUND', ERROR_MESSAGES.fileNotFound)
  }
  console.error('[classify] 读取文件指纹失败：', error)
  return fail('INTERNAL_ERROR', ERROR_MESSAGES.fileHashFailed)
}

interface FileFingerprint {
  sha256: string
  dev: number
  ino: number
}

/**
 * 读取文件内容计算真实 SHA-256，并复核文件身份：拒绝符号链接与根外路径，
 * 读取前后 dev/ino/size/mtime 变化时整次失败，不返回可能已过期的指纹。
 */
async function readFileFingerprint(
  root: AuthorizedRoot,
  relativePath: string
): Promise<Result<FileFingerprint>> {
  const rootCheck = await checkAuthorizedRoot(root)
  if (!rootCheck.ok) return rootCheck

  const absolutePath = join(root.rootPath, ...relativePath.split('/'))
  if (!insideRoot(root.rootPath, absolutePath)) {
    return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.invalidFileRelativePath)
  }

  let before
  try {
    before = await lstat(absolutePath)
  } catch (error) {
    return fingerprintFailure(error)
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    return fail('FILE_NOT_FOUND', ERROR_MESSAGES.fileNotFound)
  }

  try {
    const canonical = await realpath(absolutePath)
    if (!insideRoot(root.rootPath, canonical)) {
      return fail('PATH_OUTSIDE_ROOT', ERROR_MESSAGES.invalidFileRelativePath)
    }
    // 根路径在授权时已是 canonical；文件路径应完全一致，否则说明中间目录是符号链接。
    if (canonical !== absolutePath) {
      return fail('FILE_NOT_FOUND', ERROR_MESSAGES.fileNotFound)
    }
  } catch (error) {
    return fingerprintFailure(error)
  }

  let handle
  try {
    handle = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile()) {
      return fail('FILE_NOT_FOUND', ERROR_MESSAGES.fileNotFound)
    }
    if (opened.dev !== before.dev || opened.ino !== before.ino) {
      return fail('FILE_CHANGED', ERROR_MESSAGES.fileChanged)
    }

    const hash = createHash('sha256')
    await pipeline(createReadStream(absolutePath, { fd: handle.fd, autoClose: false }), hash)

    const after = await handle.stat()
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs
    ) {
      return fail('FILE_CHANGED', ERROR_MESSAGES.fileChanged)
    }

    const afterRoot = await checkAuthorizedRoot(root)
    if (!afterRoot.ok) return afterRoot

    let afterPath
    try {
      afterPath = await lstat(absolutePath)
    } catch (error) {
      return fingerprintFailure(error)
    }
    if (afterPath.dev !== opened.dev || afterPath.ino !== opened.ino) {
      return fail('FILE_CHANGED', ERROR_MESSAGES.fileChanged)
    }

    return ok({ sha256: hash.digest('hex'), dev: opened.dev, ino: opened.ino })
  } catch (error) {
    return fingerprintFailure(error)
  } finally {
    await handle?.close()
  }
}

/**
 * 保存单个文件的用途。首次登记生成稳定 file-* ID 与真实内容指纹；
 * 已登记文件只改 role，保留原 ID、原指纹与其他实体数据。
 * 写入复用 ProjectMetadataStore 的 lock + expectedRevision + 原子 rename。
 */
export async function classifyProjectFile(
  root: AuthorizedRoot,
  input: unknown,
  store: ProjectMetadataStore
): Promise<Result<ClassifyFileOutcome>> {
  const parsed = parseClassifyFileInput(input)
  if (!parsed.ok) return parsed
  const { relativePath, role, expectedRevision } = parsed.value

  const loaded = await store.loadProject(root)
  if (!loaded.ok) return loaded
  if (loaded.value.status === 'none') {
    return fail('PROJECT_NOT_INITIALIZED', ERROR_MESSAGES.projectNotInitialized)
  }

  const project = loaded.value.project
  if (project.revision !== expectedRevision) {
    return fail('REVISION_CONFLICT', ERROR_MESSAGES.revisionConflict)
  }

  const fingerprint = await readFileFingerprint(root, relativePath)
  if (!fingerprint.ok) return fingerprint

  const existing = project.files.find((file) => file.relativePath === relativePath)
  const file: ProjectFileRecord = existing
    ? { ...existing, role }
    : {
        id: `file-${randomUUID()}`,
        relativePath,
        role,
        sha256: fingerprint.value.sha256
      }

  const files = existing
    ? project.files.map((record) => (record.relativePath === relativePath ? file : record))
    : [...project.files, file]

  const next: ProjectMetadata = {
    ...project,
    revision: project.revision + 1,
    files
  }

  const written = await store.writeProject(root, next, expectedRevision)
  if (!written.ok) return written

  return ok({
    file,
    revision: written.value.revision,
    contentChanged: existing ? existing.sha256 !== fingerprint.value.sha256 : false
  })
}
