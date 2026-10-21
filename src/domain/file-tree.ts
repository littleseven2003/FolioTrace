import type { ProjectFileEntry } from '../shared/files'

/**
 * “全部文件”的展示层目录树：只从现有扫描结果构建，不读取目录、不跟随符号链接、
 * 不计算指纹。目录是浏览容器，不承载用途或其他业务含义。
 */
export interface FileTreeDirectory {
  kind: 'directory'
  /** 项目根相对路径，使用 / 分隔。 */
  path: string
  name: string
  depth: number
  /** 扫描到的后代文件数；不含空目录与未扫描项。 */
  fileCount: number
  children: FileTreeEntry[]
}

export interface FileTreeFile {
  kind: 'file'
  path: string
  name: string
  depth: number
  file: ProjectFileEntry
}

export type FileTreeEntry = FileTreeDirectory | FileTreeFile

export interface FileTree {
  entries: FileTreeEntry[]
  totalFiles: number
  /** 所有目录路径，用于刷新后保留仍存在的展开状态。 */
  directoryPaths: string[]
}

export type FileTreeRow =
  | { kind: 'directory'; path: string; name: string; depth: number; fileCount: number }
  | {
      kind: 'file'
      path: string
      name: string
      depth: number
      file: ProjectFileEntry
    }

export interface VisibleFileTree {
  rows: FileTreeRow[]
  totalFiles: number
  matchedFiles: number
  searching: boolean
}

function compareEntries(left: FileTreeEntry, right: FileTreeEntry): number {
  if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
  return left.name.localeCompare(right.name)
}

function sortEntries(entries: FileTreeEntry[]): void {
  entries.sort(compareEntries)
  for (const entry of entries) {
    if (entry.kind === 'directory') sortEntries(entry.children)
  }
}

function countFiles(directory: FileTreeDirectory): number {
  directory.fileCount = directory.children.reduce(
    (total, child) => total + (child.kind === 'file' ? 1 : countFiles(child)),
    0
  )
  return directory.fileCount
}

function collectDirectoryPaths(entries: FileTreeEntry[], result: string[]): void {
  for (const entry of entries) {
    if (entry.kind !== 'directory') continue
    result.push(entry.path)
    collectDirectoryPaths(entry.children, result)
  }
}

/** 由扫描文件路径构建目录树；根目录本身不是节点，根下文件直接出现在 entries。 */
export function buildFileTree(files: readonly ProjectFileEntry[]): FileTree {
  const rootEntries: FileTreeEntry[] = []
  const directories = new Map<string, FileTreeDirectory>()

  for (const file of files) {
    const segments = file.relativePath.split('/')
    const fileName = segments[segments.length - 1] ?? file.relativePath
    const directorySegments = segments.slice(0, -1)

    let siblings = rootEntries
    let prefix = ''

    for (const [index, segment] of directorySegments.entries()) {
      prefix = prefix ? `${prefix}/${segment}` : segment
      let directory = directories.get(prefix)
      if (!directory) {
        directory = {
          kind: 'directory',
          path: prefix,
          name: segment,
          depth: index,
          fileCount: 0,
          children: []
        }
        directories.set(prefix, directory)
        siblings.push(directory)
      }
      siblings = directory.children
    }

    const alreadyPresent = siblings.some(
      (entry) => entry.kind === 'file' && entry.path === file.relativePath
    )
    if (!alreadyPresent) {
      siblings.push({
        kind: 'file',
        path: file.relativePath,
        name: fileName,
        depth: directorySegments.length,
        file
      })
    }
  }

  sortEntries(rootEntries)
  for (const entry of rootEntries) {
    if (entry.kind === 'directory') countFiles(entry)
  }

  const directoryPaths: string[] = []
  collectDirectoryPaths(rootEntries, directoryPaths)
  directoryPaths.sort((left, right) => left.localeCompare(right))

  return {
    entries: rootEntries,
    totalFiles: files.length,
    directoryPaths
  }
}

function fileMatches(file: ProjectFileEntry, needle: string): boolean {
  return file.relativePath.toLowerCase().includes(needle)
}

/**
 * 计算当前应显示的行。搜索时忽略展开状态、临时显示命中文件及其祖先；
 * 清空搜索后由调用方保留的原展开状态恢复，不在搜索期间改写它。
 */
export function visibleFileTreeRows(
  tree: FileTree,
  expanded: ReadonlySet<string>,
  query: string
): VisibleFileTree {
  const needle = query.trim().toLowerCase()
  const rows: FileTreeRow[] = []

  if (needle) {
    const visit = (entries: FileTreeEntry[]): number => {
      let matched = 0
      for (const entry of entries) {
        if (entry.kind === 'file') {
          if (fileMatches(entry.file, needle)) {
            rows.push({
              kind: 'file',
              path: entry.path,
              name: entry.name,
              depth: entry.depth,
              file: entry.file
            })
            matched += 1
          }
          continue
        }

        const start = rows.length
        rows.push({
          kind: 'directory',
          path: entry.path,
          name: entry.name,
          depth: entry.depth,
          fileCount: entry.fileCount
        })
        const childMatches = visit(entry.children)
        if (childMatches === 0) rows.splice(start, 1)
        else matched += childMatches
      }
      return matched
    }

    const matchedFiles = visit(tree.entries)
    return {
      rows,
      totalFiles: tree.totalFiles,
      matchedFiles,
      searching: true
    }
  }

  const visit = (entries: FileTreeEntry[]): void => {
    for (const entry of entries) {
      if (entry.kind === 'file') {
        rows.push({
          kind: 'file',
          path: entry.path,
          name: entry.name,
          depth: entry.depth,
          file: entry.file
        })
        continue
      }

      rows.push({
        kind: 'directory',
        path: entry.path,
        name: entry.name,
        depth: entry.depth,
        fileCount: entry.fileCount
      })
      if (expanded.has(entry.path)) visit(entry.children)
    }
  }

  visit(tree.entries)

  return {
    rows,
    totalFiles: tree.totalFiles,
    matchedFiles: tree.totalFiles,
    searching: false
  }
}

/** 平铺视图的路径搜索；与目录视图使用相同的完整相对路径匹配规则。 */
export function filterFilesByPath(
  files: readonly ProjectFileEntry[],
  query: string
): ProjectFileEntry[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...files]
  return files.filter((file) => fileMatches(file, needle))
}
