import { useEffect, useState, type JSX } from 'react'
import { APP_TITLE } from '../../../shared/app'
import type { RuntimeInfo } from '../../../shared/ipc'
import type { Material, MaterialVersion } from '../../../shared/project'
import { getLatestVersion } from '../../../shared/project'
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback'
import { PlaceholderPage } from '../components/PlaceholderPage'
import { Sidebar } from '../components/Sidebar'
import { MaterialsPage } from '../features/materials/MaterialsPage'
import { useProjectSnapshot } from '../hooks/useProjectSnapshot'
import type { WorkbenchView } from './views'

interface Selection {
  materialId: string
  versionId: string
}

export function App(): JSX.Element {
  const { status, snapshot, error, reload } = useProjectSnapshot()
  const [view, setView] = useState<WorkbenchView>('materials')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)

  useEffect(() => {
    let active = true

    void window.folio
      .getRuntimeInfo()
      .then((info) => {
        if (active) setRuntime(info)
      })
      .catch(() => {
        // 运行时信息只用于侧栏展示，读取失败不影响工作台。
      })

    return () => {
      active = false
    }
  }, [])

  const activeMaterial = snapshot
    ? (snapshot.materials.find((material) => material.id === selection?.materialId) ??
      snapshot.materials[0] ??
      null)
    : null
  const activeVersion = activeMaterial
    ? (activeMaterial.versions.find((version) => version.id === selection?.versionId) ??
      getLatestVersion(activeMaterial) ??
      null)
    : null

  const handleSelectMaterial = (material: Material): void => {
    setSelection({
      materialId: material.id,
      versionId: getLatestVersion(material)?.id ?? material.currentVersionId
    })
  }

  const handleSelectVersion = (version: MaterialVersion): void => {
    if (!activeMaterial) return
    setSelection({ materialId: activeMaterial.id, versionId: version.id })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            文
          </span>
          <span className="brand-name">{APP_TITLE}</span>
        </div>
        <p className="breadcrumb">
          工作区<span aria-hidden="true">/</span>
          <strong>{snapshot?.projectName ?? '加载中…'}</strong>
        </p>
        <span className="demo-badge">模拟数据 · 只读</span>
      </header>

      {status === 'ready' && snapshot ? (
        <div className="app-body">
          <Sidebar snapshot={snapshot} view={view} runtime={runtime} onViewChange={setView} />
          <main className="workbench" aria-label="项目工作台">
            {view === 'materials' ? (
              activeMaterial && activeVersion ? (
                <MaterialsPage
                  snapshot={snapshot}
                  activeMaterial={activeMaterial}
                  activeVersion={activeVersion}
                  onSelectMaterial={handleSelectMaterial}
                  onSelectVersion={handleSelectVersion}
                />
              ) : (
                <EmptyState onReload={reload} />
              )
            ) : (
              <PlaceholderPage view={view} snapshot={snapshot} />
            )}
          </main>
        </div>
      ) : (
        <main className="workbench workbench-centered">
          {status === 'loading' ? (
            <LoadingState />
          ) : (
            <ErrorState message={error ?? '未知错误'} onRetry={reload} />
          )}
        </main>
      )}
    </div>
  )
}
