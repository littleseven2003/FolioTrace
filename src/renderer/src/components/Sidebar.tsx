import type { JSX } from 'react'
import type { RuntimeInfo } from '../../../shared/ipc'
import type { ProjectSnapshot } from '../../../shared/project'
import type { WorkbenchView } from '../app/views'
import { FilesIcon, InboxIcon, LayersIcon, WorkflowIcon, type IconProps } from './Icons'

interface NavItem {
  id: WorkbenchView
  label: string
  count: string | number
  icon: (props: IconProps) => JSX.Element
}

interface SidebarProps {
  snapshot: ProjectSnapshot
  view: WorkbenchView
  runtime: RuntimeInfo | null
  onViewChange: (view: WorkbenchView) => void
}

export function Sidebar({ snapshot, view, runtime, onViewChange }: SidebarProps): JSX.Element {
  const items: NavItem[] = [
    {
      id: 'materials',
      label: '产出材料',
      count: snapshot.materials.length,
      icon: LayersIcon
    },
    { id: 'files', label: '全部文件', count: snapshot.fileCount, icon: FilesIcon },
    { id: 'overview', label: '项目总览', count: '图谱', icon: WorkflowIcon },
    { id: 'pending', label: '待处理', count: snapshot.pendingCount, icon: InboxIcon }
  ]

  return (
    <aside className="sidebar" aria-label="项目导航">
      <div className="project-summary">
        <small>PROJECT WORKSPACE</small>
        <h2>{snapshot.projectName}</h2>
        <p>{snapshot.description}</p>
      </div>

      <nav className="nav" aria-label="主导航">
        {items.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="nav-icon" />
              <span>{item.label}</span>
              <span className="count">{item.count}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <p>
          <span className="status-dot" aria-hidden="true" />
          本地文件夹项目
        </p>
        <p>工作 / {snapshot.projectName}</p>
        <p>模拟数据，不修改实际文件</p>
        <p className="runtime-line">
          {runtime ? `Electron ${runtime.electronVersion}` : '运行时信息暂不可用'}
        </p>
      </div>
    </aside>
  )
}
