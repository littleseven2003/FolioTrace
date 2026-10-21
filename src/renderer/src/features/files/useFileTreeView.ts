import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildFileTree,
  filterFilesByPath,
  visibleFileTreeRows,
  type FileTree,
  type VisibleFileTree
} from '../../../../domain/file-tree'
import type { ProjectFileEntry } from '../../../../shared/files'

export type FileListView = 'tree' | 'flat'

export interface FileTreeViewState {
  view: FileListView
  setView: (view: FileListView) => void
  tree: FileTree
  expanded: ReadonlySet<string>
  toggleDirectory: (path: string) => void
  query: string
  setQuery: (query: string) => void
  clearQuery: () => void
  visible: VisibleFileTree
  flatFiles: ProjectFileEntry[]
  matchedFiles: number
  totalFiles: number
  searching: boolean
}

/**
 * “全部文件”的展示状态：目录展开、搜索与视图切换只影响界面，
 * 不写 project.json、不触发分类写入，也不改变扫描结果。
 */
export function useFileTreeView(
  files: readonly ProjectFileEntry[],
  projectHandle: string | null
): FileTreeViewState {
  const tree = useMemo(() => buildFileTree(files), [files])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [view, setView] = useState<FileListView>('tree')

  // 刷新后仅保留仍然存在的目录；新目录保持默认折叠。
  useEffect(() => {
    const available = new Set(tree.directoryPaths)
    setExpanded((current) => {
      const next = new Set([...current].filter((path) => available.has(path)))
      return next.size === current.size ? current : next
    })
  }, [tree])

  // 项目改变时重置视图状态，避免展开状态或搜索词串到另一个项目。
  useEffect(() => {
    setExpanded(new Set())
    setQuery('')
    setView('tree')
  }, [projectHandle])

  const toggleDirectory = useCallback((path: string): void => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const clearQuery = useCallback((): void => {
    setQuery('')
  }, [])

  const visible = useMemo(
    () => visibleFileTreeRows(tree, expanded, query),
    [expanded, query, tree]
  )
  const flatFiles = useMemo(() => filterFilesByPath(files, query), [files, query])
  const searching = query.trim().length > 0

  return {
    view,
    setView,
    tree,
    expanded,
    toggleDirectory,
    query,
    setQuery,
    clearQuery,
    visible,
    flatFiles,
    matchedFiles: view === 'tree' ? visible.matchedFiles : flatFiles.length,
    totalFiles: tree.totalFiles,
    searching
  }
}
