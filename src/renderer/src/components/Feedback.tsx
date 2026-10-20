import type { JSX } from 'react'

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function LoadingState(): JSX.Element {
  return (
    <div className="state-screen" role="status" aria-live="polite">
      <div className="state-card">
        <span className="spinner" aria-hidden="true" />
        <h2>正在读取项目快照</h2>
        <p>从本地主进程加载模拟数据，不会访问真实业务文件夹。</p>
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="state-screen">
      <div className="state-card" role="alert">
        <h2>项目快照加载失败</h2>
        <p>{message}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          重新加载
        </button>
      </div>
    </div>
  )
}

export function EmptyState({ onReload }: { onReload: () => void }): JSX.Element {
  return (
    <div className="state-screen">
      <div className="state-card">
        <h2>这个项目还没有产出材料</h2>
        <p>接入真实项目后，登记的材料与版本会显示在这里。</p>
        <button type="button" className="btn" onClick={onReload}>
          重新读取
        </button>
      </div>
    </div>
  )
}
