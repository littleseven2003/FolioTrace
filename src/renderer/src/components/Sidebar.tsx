import type { JSX } from 'react'
import type { RuntimeInfo } from '../../../shared/ipc'
import type { WorkbenchView } from '../app/views'
import { FilesIcon, InboxIcon, LayersIcon, WorkflowIcon, type IconProps } from './Icons'

interface NavItem {
  id: WorkbenchView
  label: string
  count: string | number
  icon: (props: IconProps) => JSX.Element
}

export interface SidebarCounts {
  materials: string | number
  files: string | number
  pending: string | number
}

interface SidebarProps {
  projectName: string
  description: string
  counts: SidebarCounts
  local: boolean
  view: WorkbenchView
  runtime: RuntimeInfo | null
  onViewChange: (view: WorkbenchView) => void
}

export function Sidebar({
  projectName,
  description,
  counts,
  local,
  view,
  runtime,
  onViewChange
}: SidebarProps): JSX.Element {
  const items: NavItem[] = [
    { id: 'materials', label: '产出材料', count: counts.materials, icon: LayersIcon },
    { id: 'files', label: '全部文件', count: counts.files, icon: FilesIcon },
    { id: 'overview', label: '项目总览', count: '图谱', icon: WorkflowIcon },
    { id: 'pending', label: '待处理', count: counts.pending, icon: InboxIcon }
  ]

  return (
    <aside className="sidebar" aria-label="项目导航">
      <div className="project-summary">
        <small>PROJECT WORKSPACE</small>
        <h2>{projectName}</h2>
        <p>{description}</p>
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
          {local ? '真实目录 · 只读' : '模拟演示项目'}
        </p>
        <p>{local ? `工作 / ${projectName}` : '合成数据，不写磁盘'}</p>
        <p>{local ? '扫描不写入业务文件' : '模拟数据，不修改实际文件'}</p>
        <p className="runtime-line">
          {runtime ? `Electron ${runtime.electronVersion}` : '运行时信息暂不可用'}
        </p>
      </div>
    </aside>
  )
}
