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

export interface ScanStats {
  size: number
  mtimeMs: number
  isFile: () => boolean
  isSymbolicLink: () => boolean
}

/** 可注入的最小文件系统接口，用于测试不存在/权限不足等竞态。 */
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
}

const WARNING_MESSAGES: Record<ScanWarning['code'], string> = {
  PERMISSION_DENIED: '没有读取权限，已跳过。',
  ENTRY_DISAPPEARED: '扫描期间文件已不存在，已跳过。',
  PATH_OUTSIDE_ROOT: '路径位于项目根目录之外，已跳过。',
  UNREADABLE_DIRECTORY: '无法读取该目录，已跳过。'
}

function warning(
  code: ScanWarning['code'],
  relativePath: string
): ScanWarning {
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

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${sep}`)
}

async function walkDirectory(
  absoluteDirectory: string,
  relativeDirectory: string,
  rootPath: string,
  fs: ScanFileSystem,
  files: ProjectFileEntry[],
  warnings: ScanWarning[]
): Promise<void> {
  let entries: ScanDirent[]
  try {
    entries = await fs.readdir(absoluteDirectory)
  } catch (error) {
    warnings.push(
      warning(isPermissionError(error) ? 'PERMISSION_DENIED' : 'UNREADABLE_DIRECTORY', relativeDirectory || '.')
    )
    return
  }

  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
    const absolutePath = join(absoluteDirectory, entry.name)

    // 无论符号链接指向根内还是根外，都不跟随。
    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      if (isInternalDirectoryName(entry.name)) continue

      let realDirectory: string
      try {
        realDirectory = await fs.realpath(absolutePath)
      } catch (error) {
        warnings.push(
          warning(
            isPermissionError(error)
              ? 'PERMISSION_DENIED'
              : errorCode(error) === 'ENOENT'
                ? 'ENTRY_DISAPPEARED'
                : 'UNREADABLE_DIRECTORY',
            relativePath
          )
        )
        continue
      }

      if (!isWithinRoot(rootPath, realDirectory)) {
        warnings.push(warning('PATH_OUTSIDE_ROOT', relativePath))
        continue
      }

      await walkDirectory(realDirectory, relativePath, rootPath, fs, files, warnings)
      continue
    }

    if (!entry.isFile() || isInternalFileName(entry.name)) continue

    try {
      const stats = await fs.lstat(absolutePath)
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
    } catch (error) {
      warnings.push(
        warning(
          isPermissionError(error)
            ? 'PERMISSION_DENIED'
            : errorCode(error) === 'ENOENT'
              ? 'ENTRY_DISAPPEARED'
              : 'UNREADABLE_DIRECTORY',
          relativePath
        )
      )
    }
  }
}

/**
 * 只读扫描授权目录。rootPath 必须是主进程登记过的 canonical 路径；
 * 扫描过程中不再接受任何 renderer 提供的路径。
 */
export async function scanProjectDirectory(
  handle: string,
  rootPath: string,
  options: ScanOptions = {}
): Promise<ProjectScan> {
  const fs = options.fs ?? nodeScanFileSystem
  const files: ProjectFileEntry[] = []
  const warnings: ScanWarning[] = []

  let canonicalRoot: string
  try {
    canonicalRoot = await fs.realpath(rootPath)
  } catch (error) {
    throw new Error(
      `无法解析项目根目录（${errorCode(error) ?? 'UNKNOWN'}）`,
      { cause: error }
    )
  }

  if (canonicalRoot !== rootPath) {
    return {
      handle,
      scannedAt: (options.now?.() ?? new Date()).toISOString(),
      files,
      warnings: [warning('PATH_OUTSIDE_ROOT', '.')]
    }
  }

  await walkDirectory(canonicalRoot, '', canonicalRoot, fs, files, warnings)
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))

  return {
    handle,
    scannedAt: (options.now?.() ?? new Date()).toISOString(),
    files,
    warnings
  }
}
