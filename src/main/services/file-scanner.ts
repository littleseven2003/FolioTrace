import { lstat, readdir, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { classifyFileName, isInternalDirectoryName, isInternalFileName } from '../../domain/file-scan'
import type { ProjectFileEntry, ProjectScan, ScanWarning } from '../../shared/files'

export interface ScanDirent {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
  isSymbolicLink: () => boolean
}

export interface FileIdentity {
  dev: number
  ino: number
}

export interface ScanStats {
  size: number
  mtimeMs: number
  dev: number
  ino: number
  isFile: () => boolean
  isDirectory: () => boolean
  isSymbolicLink: () => boolean
}

/** 可注入的最小文件系统接口，用于测试路径替换等竞态。 */
export interface ScanFileSystem {
  readdir: (absolutePath: string) => Promise<ScanDirent[]>
  lstat: (absolutePath: string) => Promise<ScanStats>
  realpath: (absolutePath: string) => Promise<string>
}

export const nodeScanFileSystem: ScanFileSystem = {
  readdir: (absolutePath) => readdir(absolutePath, { withFileTypes: true }),
  lstat,
  realpath
}

export interface ScanOptions {
  fs?: ScanFileSystem
  now?: () => Date
  /** 授权时记录的根目录 dev/ino；扫描开始时必须仍指向同一目录。 */
  expectedRootIdentity?: FileIdentity
}

const ABORT_MESSAGE = '扫描期间目录发生变化，已终止本次扫描，未采用任何文件结果。'

const WARNING_MESSAGES: Record<ScanWarning['code'], string> = {
  PERMISSION_DENIED: '没有读取权限，已跳过。',
  ENTRY_DISAPPEARED: '扫描期间文件已不存在，已跳过。',
  PATH_OUTSIDE_ROOT: '路径位于项目根目录之外，已跳过。',
  UNREADABLE_DIRECTORY: '无法读取该目录，已跳过。',
  SCAN_ABORTED: ABORT_MESSAGE
}

class ScanAbortedError extends Error {
  readonly relativePath: string

  constructor(relativePath: string) {
    super(ABORT_MESSAGE)
    this.name = 'ScanAbortedError'
    this.relativePath = relativePath
  }
}

class DirectoryAccessError extends Error {
  readonly code: string | undefined

  constructor(error: unknown) {
    super('无法访问目录')
    this.name = 'DirectoryAccessError'
    this.code = errorCode(error)
  }
}

interface DirectorySnapshot {
  path: string
  realPath: string
  relativePath: string
  identity: FileIdentity
}

function warning(code: ScanWarning['code'], relativePath: string): ScanWarning {
  return { code, relativePath, message: WARNING_MESSAGES[code] }
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

function isMissingError(error: unknown): boolean {
  return errorCode(error) === 'ENOENT'
}

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${sep}`)
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

/**
 * 读取目录前先确认：realpath 仍在根内、最终组件不是符号链接、目录身份可读。
 * 这只是读前校验；调用方还必须在读取后再次校验身份。
 */
async function inspectDirectory(
  path: string,
  relativePath: string,
  rootPath: string,
  fs: ScanFileSystem
): Promise<DirectorySnapshot> {
  let resolvedPath: string
  try {
    resolvedPath = await fs.realpath(path)
  } catch (error) {
    throw new DirectoryAccessError(error)
  }

  if (!isWithinRoot(rootPath, resolvedPath)) {
    throw new ScanAbortedError(relativePath)
  }

  let stats: ScanStats
  try {
    stats = await fs.lstat(path)
  } catch (error) {
    throw new DirectoryAccessError(error)
  }

  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new ScanAbortedError(relativePath)
  }

  return {
    path,
    realPath: resolvedPath,
    relativePath,
    identity: { dev: stats.dev, ino: stats.ino }
  }
}

/** 读后复核：realpath 或 dev/ino 变化都视为目录被替换，整次扫描终止。 */
async function assertUnchanged(
  snapshot: DirectorySnapshot,
  rootPath: string,
  fs: ScanFileSystem
): Promise<void> {
  let current: DirectorySnapshot
  try {
    current = await inspectDirectory(snapshot.path, snapshot.relativePath, rootPath, fs)
  } catch {
    throw new ScanAbortedError(snapshot.relativePath)
  }

  if (
    current.realPath !== snapshot.realPath ||
    !sameIdentity(current.identity, snapshot.identity)
  ) {
    throw new ScanAbortedError(snapshot.relativePath)
  }
}

function pushReadWarning(
  error: unknown,
  relativePath: string,
  warnings: ScanWarning[]
): void {
  if (isPermissionError(error)) {
    warnings.push(warning('PERMISSION_DENIED', relativePath))
  } else if (isMissingError(error)) {
    warnings.push(warning('ENTRY_DISAPPEARED', relativePath))
  } else {
    warnings.push(warning('UNREADABLE_DIRECTORY', relativePath))
  }
}

async function walkDirectory(
  snapshot: DirectorySnapshot,
  rootPath: string,
  fs: ScanFileSystem,
  files: ProjectFileEntry[],
  warnings: ScanWarning[],
  visitedDirectories: DirectorySnapshot[]
): Promise<void> {
  await assertUnchanged(snapshot, rootPath, fs)

  let entries: ScanDirent[]
  try {
    entries = await fs.readdir(snapshot.realPath)
  } catch (error) {
    pushReadWarning(error, snapshot.relativePath || '.', warnings)
    return
  }

  // readdir 之后立刻复核；若路径在这段时间被替换，丢弃整个目录的结果。
  await assertUnchanged(snapshot, rootPath, fs)
  visitedDirectories.push(snapshot)
  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const relativePath = snapshot.relativePath
      ? `${snapshot.relativePath}/${entry.name}`
      : entry.name

    // 无论符号链接指向根内还是根外，都不跟随。
    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      if (isInternalDirectoryName(entry.name)) continue

      let child: DirectorySnapshot
      try {
        child = await inspectDirectory(
          join(snapshot.realPath, entry.name),
          relativePath,
          rootPath,
          fs
        )
      } catch (error) {
        if (error instanceof ScanAbortedError) throw error
        if (error instanceof DirectoryAccessError) {
          pushReadWarning(error, relativePath, warnings)
          continue
        }
        throw error
      }

      await walkDirectory(child, rootPath, fs, files, warnings, visitedDirectories)
      continue
    }

    if (!entry.isFile() || isInternalFileName(entry.name)) continue

    // 文件元数据读取前后都复核父目录；父目录被替换时终止整次扫描。
    await assertUnchanged(snapshot, rootPath, fs)

    let stats: ScanStats
    try {
      stats = await fs.lstat(join(snapshot.realPath, entry.name))
    } catch (error) {
      pushReadWarning(error, relativePath, warnings)
      continue
    }

    await assertUnchanged(snapshot, rootPath, fs)

    if (!stats.isFile() || stats.isSymbolicLink()) continue

    const { type, category } = classifyFileName(entry.name)
    files.push({
      relativePath,
      type,
      category,
      sizeBytes: stats.size,
      modifiedAt: new Date(stats.mtimeMs).toISOString(),
      classification: 'unclassified'
    })
  }
}

/**
 * 只读扫描授权目录。rootPath 必须是主进程登记过的 canonical 路径；
 * 调用方应传入授权时的根目录 dev/ino，以发现根目录在扫描开始前被替换。
 *
 * 限制：Node 在 macOS 上没有可用的 openat/fd-relative 元数据接口，
 * 因此这里采用“读前校验 + 读后复核 + 身份不符即整次终止”的失效关闭策略。
 * 仍无法排除本地攻击者在单次系统调用边界内瞬时替换并恢复路径的极端竞态。
 */
export async function scanProjectDirectory(
  handle: string,
  rootPath: string,
  options: ScanOptions = {}
): Promise<ProjectScan> {
  const fs = options.fs ?? nodeScanFileSystem
  const scannedAt = (options.now?.() ?? new Date()).toISOString()
  const abort = (relativePath: string): ProjectScan => ({
    handle,
    scannedAt,
    files: [],
    warnings: [warning('SCAN_ABORTED', relativePath)]
  })

  let canonicalRoot: string
  try {
    canonicalRoot = await fs.realpath(rootPath)
  } catch (error) {
    throw new Error(`无法解析项目根目录（${errorCode(error) ?? 'UNKNOWN'}）`, { cause: error })
  }

  if (canonicalRoot !== rootPath) {
    return abort('.')
  }

  let rootSnapshot: DirectorySnapshot
  try {
    const inspectedRoot = await inspectDirectory(rootPath, '.', canonicalRoot, fs)
    // 根目录在拼接相对路径时使用空前缀；显示根级警告时仍用 '.'。
    rootSnapshot = { ...inspectedRoot, relativePath: '' }
  } catch (error) {
    if (error instanceof ScanAbortedError) return abort(error.relativePath || '.')
    if (error instanceof DirectoryAccessError) {
      return {
        handle,
        scannedAt,
        files: [],
        warnings: [
          warning(isPermissionError(error) ? 'PERMISSION_DENIED' : 'UNREADABLE_DIRECTORY', '.')
        ]
      }
    }
    throw error
  }

  if (
    options.expectedRootIdentity &&
    !sameIdentity(rootSnapshot.identity, options.expectedRootIdentity)
  ) {
    return abort('.')
  }

  const files: ProjectFileEntry[] = []
  const warnings: ScanWarning[] = []
  const visitedDirectories: DirectorySnapshot[] = []

  try {
    await walkDirectory(rootSnapshot, canonicalRoot, fs, files, warnings, visitedDirectories)

    // 扫描收尾时复核所有访问过的目录，发现任何替换都丢弃全部结果。
    for (const directory of visitedDirectories) {
      await assertUnchanged(directory, canonicalRoot, fs)
    }
  } catch (error) {
    if (error instanceof ScanAbortedError) return abort(error.relativePath || '.')
    throw error
  }

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  return { handle, scannedAt, files, warnings }
}
