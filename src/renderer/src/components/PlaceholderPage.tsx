import type { JSX } from 'react'
import type { ProjectSnapshot } from '../../../shared/project'
import { PLACEHOLDER_CONTENT, type WorkbenchView } from '../app/views'
import { FilesIcon, InboxIcon, WorkflowIcon } from './Icons'

interface PlaceholderPageProps {
  view: Exclude<WorkbenchView, 'materials'>
  snapshot: ProjectSnapshot
}

export function PlaceholderPage({ view, snapshot }: PlaceholderPageProps): JSX.Element {
  const content = PLACEHOLDER_CONTENT[view]
  const Icon = view === 'files' ? FilesIcon : view === 'overview' ? WorkflowIcon : InboxIcon

  return (
    <section className="page" aria-labelledby="placeholder-title">
      <div className="page-heading">
        <div>
          <h1 id="placeholder-title">{content.title}</h1>
          <p>
            {snapshot.projectName} · {content.description}
          </p>
        </div>
        <span className="page-meta">模拟快照 · revision {snapshot.revision}</span>
      </div>

      <div className="panel placeholder-panel">
        <span className="placeholder-icon" aria-hidden="true">
          <Icon />
        </span>
        <h2>该页面尚未接入</h2>
        <p>{content.body}</p>
        <span className="badge badge-muted">M1 占位 · 计划 {content.milestone}</span>
      </div>
    </section>
  )
}
