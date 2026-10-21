import type { JSX } from 'react'
import type { WorkbenchView } from '../app/views'
import { FilesIcon, InboxIcon, LayersIcon, WorkflowIcon } from './Icons'

interface LocalModePageProps {
  view: Exclude<WorkbenchView, 'files'>
  projectName: string
}

const CONTENT = {
  materials: {
    title: '产出材料',
    description: '真实目录只读模式',
    body: '产出材料、版本登记与当前采用将在 M3 接入。当前可先在“全部文件”查看真实目录清单。',
    milestone: 'M3',
    icon: LayersIcon
  },
  overview: {
    title: '项目总览',
    description: '真实目录只读模式',
    body: '版本图谱与跨材料配套关系将在 M3 接入。当前扫描只提供文件清单。',
    milestone: 'M3',
    icon: WorkflowIcon
  },
  pending: {
    title: '待处理',
    description: '真实目录只读模式',
    body: '变更导入、文件对账与异常恢复将在 M5 接入。M2 只读扫描不会生成待处理事项。',
    milestone: 'M5',
    icon: InboxIcon
  }
} as const

export function LocalModePage({ view, projectName }: LocalModePageProps): JSX.Element {
  const content = CONTENT[view]
  const Icon = content.icon

  return (
    <section className="page" aria-labelledby="local-mode-title">
      <div className="page-heading">
        <div>
          <h1 id="local-mode-title">{content.title}</h1>
          <p>
            {projectName} · {content.description}
          </p>
        </div>
        <span className="page-meta">真实目录 · 只读</span>
      </div>

      <div className="panel placeholder-panel">
        <span className="placeholder-icon" aria-hidden="true">
          <Icon />
        </span>
        <h2>该页面将在 {content.milestone} 接入</h2>
        <p>{content.body}</p>
        <span className="badge badge-muted">M2 暂不展示模拟数据</span>
        <p className="local-mode-hint">
          为避免混淆，接入真实目录后不再显示 M1 的模拟材料；可切换到“全部文件”查看扫描结果。
        </p>
        <span className="placeholder-file-hint">
          <FilesIcon className="inline-icon" /> 全部文件
        </span>
      </div>
    </section>
  )
}
