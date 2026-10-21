import { useEffect, useState, type JSX } from 'react'
import { APP_TITLE } from '../../../shared/app'
import type { RuntimeInfo } from '../../../shared/ipc'
import type { Material, MaterialVersion } from '../../../shared/project'
import { getLatestVersion } from '../../../shared/project'
import { BrandMark } from '../components/BrandMark'
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback'
import { LocalModePage } from '../components/LocalModePage'
import { PlaceholderPage } from '../components/PlaceholderPage'
import { Sidebar } from '../components/Sidebar'
import { FilesPage } from '../features/files/FilesPage'
import { MaterialsPage } from '../features/materials/MaterialsPage'
import { useLocalProject } from '../hooks/useLocalProject'
import { useProjectSnapshot } from '../hooks/useProjectSnapshot'
import type { WorkbenchView } from './views'

interface Selection {
  materialId: string
  versionId: string
}

export function App(): JSX.Element {
  const { status, snapshot, error, reload } = useProjectSnapshot()
  const local = useLocalProject()
  const [view, setView] = useState<WorkbenchView>('materials')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null)

  useEffect(() => {
    let active = true

    void window.folio
      .getRuntimeInfo()
      .then((result) => {
        if (active && result.ok) setRuntime(result.value)
      })
      .catch(() => {
        // 运行时信息只用于侧栏展示，读取失败不影响工作台。
      })

    return () => {
      active = false
    }
  }, [])

  const demoSnapshot = status === 'ready' ? snapshot : null
  const isLocal = local.project !== null
  const activeMaterial = demoSnapshot
    ? (demoSnapshot.materials.find((material) => material.id === selection?.materialId) ??
      demoSnapshot.materials[0] ??
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

  const projectName = isLocal && local.project ? local.project.name : (demoSnapshot?.projectName ?? '加载中…')

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">{APP_TITLE}</span>
        </div>
        <p className="breadcrumb">
          工作区<span aria-hidden="true">/</span>
          <strong>{projectName}</strong>
        </p>
        <span className={`demo-badge ${isLocal ? 'local-badge' : ''}`}>
          {isLocal ? '本地目录 · 只读' : '模拟数据 · 只读'}
        </span>
      </header>

      {isLocal || demoSnapshot ? (
        <div className="app-body">
          {isLocal && local.project ? (
            <Sidebar
              projectName={local.project.name}
              description="本地目录 · 只读扫描"
              counts={{
                materials: '—',
                files: local.scan?.files.length ?? '…',
                pending: '—'
              }}
              local
              view={view}
              runtime={runtime}
              onViewChange={setView}
            />
          ) : demoSnapshot ? (
            <Sidebar
              projectName={demoSnapshot.projectName}
              description={demoSnapshot.description}
              counts={{
                materials: demoSnapshot.materials.length,
                files: demoSnapshot.fileCount,
                pending: demoSnapshot.pendingCount
              }}
              local={false}
              view={view}
              runtime={runtime}
              onViewChange={setView}
            />
          ) : null}

          <main className="workbench" aria-label="项目工作台">
            {view === 'files' ? (
              <FilesPage
                key={local.project?.handle ?? 'no-project'}
                local={local}
                onChooseProject={() => void local.chooseProject()}
                onRescan={() => void local.rescan()}
                onInitializeProject={() => void local.initializeProject()}
                onReloadMetadata={() => void local.reloadMetadata()}
                onClassifyFile={(relativePath, role) => void local.classifyFile(relativePath, role)}
              />
            ) : isLocal && local.project ? (
              <LocalModePage view={view} projectName={local.project.name} />
            ) : demoSnapshot ? (
              view === 'materials' ? (
                activeMaterial && activeVersion ? (
                  <MaterialsPage
                    snapshot={demoSnapshot}
                    activeMaterial={activeMaterial}
                    activeVersion={activeVersion}
                    onSelectMaterial={handleSelectMaterial}
                    onSelectVersion={handleSelectVersion}
                  />
                ) : (
                  <EmptyState onReload={reload} />
                )
              ) : (
                <PlaceholderPage view={view} snapshot={demoSnapshot} />
              )
            ) : (
              <EmptyState onReload={reload} />
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
