import type { JSX } from 'react'
import { FilesIcon } from '../../components/Icons'
import { formatBytes, formatDateTime } from '../../lib/format'
import type { LocalProjectState } from '../../hooks/useLocalProject'

interface FilesPageProps {
  local: LocalProjectState
  onChooseProject: () => void
  onRescan: () => void
}

export function FilesPage({ local, onChooseProject, onRescan }: FilesPageProps): JSX.Element {
  const { project, scan, choosing, scanning, error, notice } = local
  const files = scan?.files ?? []

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
              共 <strong>{files.length}</strong> 个文件
              {scan ? ` · 扫描于 ${formatDateTime(scan.scannedAt)}` : ''}
            </p>
            <button type="button" className="btn" onClick={onRescan} disabled={scanning}>
              {scanning ? '正在扫描…' : '重新扫描'}
            </button>
          </div>

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
            files.length > 0 ? (
              <section className="panel file-list-panel" aria-label="文件清单">
                <div className="file-table-wrap">
                  <table className="file-table">
                    <thead>
                      <tr>
                        <th scope="col">相对路径</th>
                        <th scope="col">类型</th>
                        <th scope="col">大小</th>
                        <th scope="col">修改时间</th>
                        <th scope="col">分类</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr key={file.relativePath}>
                          <td>
                            <span className="file-path mono">{file.relativePath}</span>
                          </td>
                          <td>
                            <span className="file-type">{file.type}</span>
                          </td>
                          <td className="file-number">{formatBytes(file.sizeBytes)}</td>
                          <td className="file-number">{formatDateTime(file.modifiedAt)}</td>
                          <td>
                            <span className="badge badge-muted">未分类</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <footer className="panel-footer">
                  <span>未分类文件不会自动加入参考资料。</span>
                  <span>扫描只读 · 不写入业务文件</span>
                </footer>
              </section>
            ) : (
              <div className="panel empty-panel">
                <h2>这个文件夹没有可读取的业务文件</h2>
                <p>内部管理目录与符号链接不会出现在清单中。</p>
              </div>
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
