import type { JSX } from 'react'
import type { FileTreeRow } from '../../../../domain/file-tree'
import {
  FILE_ROLE_LABELS,
  FILE_ROLES,
  type FileRole,
  type ProjectFileEntry
} from '../../../../shared/files'
import { FilesIcon } from '../../components/Icons'
import { formatBytes, formatDateTime } from '../../lib/format'
import type { LocalProjectState } from '../../hooks/useLocalProject'
import { useFileTreeView, type FileListView } from './useFileTreeView'

interface FilesPageProps {
  local: LocalProjectState
  onChooseProject: () => void
  onRescan: () => void
  onInitializeProject: () => void
  onReloadMetadata: () => void
  onClassifyFile: (relativePath: string, role: FileRole) => void
}

interface DirectoryRowProps {
  row: Extract<FileTreeRow, { kind: 'directory' }>
  expanded: boolean
  searching: boolean
  onToggle: (path: string) => void
}

function DirectoryRow({ row, expanded, searching, onToggle }: DirectoryRowProps): JSX.Element {
  // 搜索期间命中祖先临时展开：箭头与 aria-expanded 必须跟随实际可见行，
  // 并禁用折叠，避免搜索点击改写清除搜索后应恢复的普通展开状态。
  const visibleExpanded = searching || expanded

  return (
    <tr className="file-row-directory">
      <td style={{ paddingLeft: `${16 + row.depth * 18}px` }}>
        <button
          type="button"
          className="file-tree-toggle"
          aria-expanded={visibleExpanded}
          aria-label={`${row.path}，目录，${row.fileCount} 个文件`}
          disabled={searching}
          title={searching ? '搜索期间目录保持展开' : undefined}
          onClick={() => onToggle(row.path)}
        >
          <span className="file-tree-chevron" aria-hidden="true">
            {visibleExpanded ? '▾' : '▸'}
          </span>
          <span className="file-path file-tree-path">{row.path}</span>
          <span className="file-tree-count">{row.fileCount} 个文件</span>
        </button>
      </td>
      <td>目录</td>
      <td className="file-number">—</td>
      <td className="file-number">—</td>
      <td>
        <span className="file-tree-role">—</span>
      </td>
    </tr>
  )
}

interface FileRowProps {
  file: ProjectFileEntry
  depth: number
  treeMode: boolean
  initialized: boolean
  role: FileRole
  disabled: boolean
  onClassifyFile: (relativePath: string, role: FileRole) => void
}

function FileRow({
  file,
  depth,
  treeMode,
  initialized,
  role,
  disabled,
  onClassifyFile
}: FileRowProps): JSX.Element {
  return (
    <tr>
      <td style={treeMode ? { paddingLeft: `${16 + depth * 18}px` } : undefined}>
        <span className="file-path mono">{file.relativePath}</span>
      </td>
      <td>
        <span className="file-type">{file.type}</span>
      </td>
      <td className="file-number">{formatBytes(file.sizeBytes)}</td>
      <td className="file-number">{formatDateTime(file.modifiedAt)}</td>
      <td>
        {initialized ? (
          <select
            className="role-select"
            aria-label={`${file.relativePath} 的用途`}
            value={role}
            disabled={disabled}
            onChange={(event) => onClassifyFile(file.relativePath, event.target.value as FileRole)}
          >
            {FILE_ROLES.map((option) => (
              <option key={option} value={option}>
                {FILE_ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        ) : (
          <span className="badge badge-muted">未分类</span>
        )}
      </td>
    </tr>
  )
}

interface ViewSwitchProps {
  view: FileListView
  onChange: (view: FileListView) => void
}

function ViewSwitch({ view, onChange }: ViewSwitchProps): JSX.Element {
  return (
    <div className="view-switch" role="group" aria-label="文件视图">
      <button
        type="button"
        className="btn view-switch-btn"
        aria-pressed={view === 'tree'}
        onClick={() => onChange('tree')}
      >
        目录
      </button>
      <button
        type="button"
        className="btn view-switch-btn"
        aria-pressed={view === 'flat'}
        onClick={() => onChange('flat')}
      >
        平铺
      </button>
    </div>
  )
}

export function FilesPage({
  local,
  onChooseProject,
  onRescan,
  onInitializeProject,
  onReloadMetadata,
  onClassifyFile
}: FilesPageProps): JSX.Element {
  const {
    project,
    scan,
    metadata,
    choosing,
    scanning,
    metadataLoading,
    initializing,
    classifyingPath,
    error,
    metadataError,
    notice
  } = local
  const files = scan?.files ?? []
  const initialized = metadata?.status === 'loaded'
  const roleByPath = new Map<string, FileRole>(
    metadata?.status === 'loaded'
      ? metadata.files.map((file) => [file.relativePath, file.role])
      : []
  )
  const treeView = useFileTreeView(files, project?.handle ?? null)
  const { rows, matchedFiles, totalFiles, searching } = treeView.visible
  const showNoMatch = files.length > 0 && searching && matchedFiles === 0

  return (
    <section className="page" aria-labelledby="files-title">
      <div className="page-heading">
        <div>
          <h1 id="files-title">全部文件</h1>
          <p>
            {project
              ? `${project.name} · 本地目录只读扫描 · 文件保留在原有位置`
              : '接入现有文件夹，只读取文件信息，不移动、不改写文件。'}
          </p>
        </div>
        {project && <span className="page-meta">本地目录 · 只读</span>}
      </div>

      {notice && (
        <p className="notice-inline" role="status">
          {notice}
        </p>
      )}

      {!project ? (
        <div className="panel choose-panel">
          <span className="choose-icon" aria-hidden="true">
            <FilesIcon />
          </span>
          <h2>接入一个本地文件夹</h2>
          <p>
            扫描只读取相对路径、类型、大小和修改时间。不会移动、删除或改写业务文件，也不会创建
            project.json 或 AGENTS.md。
          </p>

          {error && (
            <div className="alert-inline" role="alert">
              <p>{error}</p>
              <button type="button" className="btn" onClick={onChooseProject} disabled={choosing}>
                {choosing ? '正在打开…' : '重新选择'}
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={onChooseProject}
            disabled={choosing}
          >
            {choosing ? '正在打开文件夹…' : '打开文件夹'}
          </button>
          <p className="choose-hint">
            默认忽略 .git、.docwork、node_modules 等内部目录；不跟随符号链接。
          </p>
        </div>
      ) : (
        <>
          <div className="files-toolbar">
            <p className="files-summary">
              共 <strong>{totalFiles}</strong> 个文件
              {searching ? ` · 匹配 ${matchedFiles} 个` : ''}
              {scan ? ` · 扫描于 ${formatDateTime(scan.scannedAt)}` : ''}
            </p>
            <div className="files-toolbar-actions">
              <ViewSwitch view={treeView.view} onChange={treeView.setView} />
              <button type="button" className="btn" onClick={onRescan} disabled={scanning}>
                {scanning ? '正在扫描…' : '重新扫描'}
              </button>
            </div>
          </div>

          {scan && files.length > 0 && (
            <div className="files-search">
              <input
                type="search"
                className="files-search-input"
                aria-label="按完整相对路径搜索"
                placeholder="按完整相对路径搜索，例如 images/封面.png"
                value={treeView.query}
                onChange={(event) => treeView.setQuery(event.target.value)}
              />
              {searching && (
                <button type="button" className="btn" onClick={treeView.clearQuery}>
                  清除搜索
                </button>
              )}
            </div>
          )}

          <section className="panel metadata-panel" aria-label="文脉项目元数据">
            <div className="metadata-panel-head">
              <h2>文脉项目元数据</h2>
              {metadata?.status === 'loaded' && (
                <span className="badge badge-current">已初始化</span>
              )}
            </div>

            {metadataLoading ? (
              <p className="metadata-hint" role="status" aria-live="polite">
                正在读取 .docwork/project.json…
              </p>
            ) : metadataError ? (
              <div className="alert-inline" role="alert">
                <p>{metadataError}</p>
                <button type="button" className="btn" onClick={onReloadMetadata}>
                  重新读取元数据
                </button>
              </div>
            ) : metadata?.status === 'loaded' ? (
              <p className="metadata-hint">
                revision {metadata.summary.revision} · 文件记录 {metadata.summary.fileCount} ·
                材料 {metadata.summary.documentCount}。打开文件夹默认只读；后续写操作需显式触发。
              </p>
            ) : (
              <div className="metadata-empty">
                <p>
                  该文件夹尚未初始化文脉项目。初始化会创建{' '}
                  <span className="mono">.docwork/project.json</span>（revision 1），不会移动或修改原文件；
                  扫描结果不会自动成为参考资料。
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onInitializeProject}
                  disabled={initializing}
                >
                  {initializing ? '正在初始化…' : '初始化文脉项目'}
                </button>
              </div>
            )}
          </section>

          {error && (
            <div className="alert-inline" role="alert">
              <p>{error}</p>
              <button type="button" className="btn" onClick={onRescan} disabled={scanning}>
                重试扫描
              </button>
            </div>
          )}

          {scan && scan.warnings.length > 0 && (
            <section className="panel scan-warnings" aria-label="扫描提示">
              <h2>扫描提示（{scan.warnings.length}）</h2>
              <ul>
                {scan.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.relativePath}`}>
                    <span className="mono">
                      {warning.relativePath === '.' ? '项目根目录' : warning.relativePath}
                    </span>
                    ：{warning.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {scan ? (
            files.length === 0 ? (
              <div className="panel empty-panel">
                <h2>这个文件夹没有可读取的业务文件</h2>
                <p>内部管理目录与符号链接不会出现在清单中。</p>
              </div>
            ) : showNoMatch ? (
              <div className="panel empty-panel" role="status" aria-live="polite">
                <h2>没有匹配的文件</h2>
                <p>没有完整相对路径包含“{treeView.query.trim()}”的文件。</p>
                <button type="button" className="btn" onClick={treeView.clearQuery}>
                  清除搜索
                </button>
              </div>
            ) : (
              <section className="panel file-list-panel" aria-label="文件清单">
                <div className="file-table-wrap">
                  <table className="file-table">
                    <thead>
                      <tr>
                        <th scope="col">相对路径</th>
                        <th scope="col">类型</th>
                        <th scope="col">大小</th>
                        <th scope="col">修改时间</th>
                        <th scope="col">用途</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treeView.view === 'tree'
                        ? rows.map((row) =>
                            row.kind === 'directory' ? (
                              <DirectoryRow
                                key={`dir:${row.path}`}
                                row={row}
                                expanded={treeView.expanded.has(row.path)}
                                searching={searching}
                                onToggle={treeView.toggleDirectory}
                              />
                            ) : (
                              <FileRow
                                key={`file:${row.path}`}
                                file={row.file}
                                depth={row.depth}
                                treeMode
                                initialized={initialized}
                                role={roleByPath.get(row.path) ?? 'unclassified'}
                                disabled={classifyingPath !== null}
                                onClassifyFile={onClassifyFile}
                              />
                            )
                          )
                        : treeView.flatFiles.map((file) => (
                            <FileRow
                              key={`file:${file.relativePath}`}
                              file={file}
                              depth={0}
                              treeMode={false}
                              initialized={initialized}
                              role={roleByPath.get(file.relativePath) ?? 'unclassified'}
                              disabled={classifyingPath !== null}
                              onClassifyFile={onClassifyFile}
                            />
                          ))}
                    </tbody>
                  </table>
                </div>
                <footer className="panel-footer">
                  <span>
                    目录由扫描结果构建，仅作浏览容器，不设置用途；展开或切换视图不会写入
                    project.json。
                  </span>
                  <span>扫描只读 · 不写入业务文件</span>
                </footer>
              </section>
            )
          ) : scanning ? (
            <div className="panel empty-panel" role="status" aria-live="polite">
              <h2>正在扫描文件…</h2>
              <p>只读取文件元数据，不会修改目录内容。</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
