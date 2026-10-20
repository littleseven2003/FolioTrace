import type { JSX } from 'react'
import type { Material, MaterialVersion, ProjectSnapshot } from '../../../../shared/project'
import { MaterialCard } from './MaterialCard'
import { VersionDetail } from './VersionDetail'
import { VersionTimeline } from './VersionTimeline'

interface MaterialsPageProps {
  snapshot: ProjectSnapshot
  activeMaterial: Material
  activeVersion: MaterialVersion
  onSelectMaterial: (material: Material) => void
  onSelectVersion: (version: MaterialVersion) => void
}

export function MaterialsPage({
  snapshot,
  activeMaterial,
  activeVersion,
  onSelectMaterial,
  onSelectVersion
}: MaterialsPageProps): JSX.Element {
  return (
    <section className="page" aria-labelledby="materials-title">
      <div className="page-heading">
        <div>
          <h1 id="materials-title">让每次修改，有迹可循。</h1>
          <p>
            {snapshot.projectName} · {snapshot.materials.length} 份产出材料 · 文件保留在原有位置
          </p>
        </div>
        <span className="page-meta">模拟快照 · revision {snapshot.revision}</span>
      </div>

      <div className="materials-grid" role="list" aria-label="产出材料">
        {snapshot.materials.map((material) => (
          <div key={material.id} role="listitem">
            <MaterialCard
              material={material}
              selected={material.id === activeMaterial.id}
              onSelect={onSelectMaterial}
            />
          </div>
        ))}
      </div>

      <div className="workspace-grid">
        <section className="panel timeline-panel" aria-labelledby="timeline-title">
          <header className="panel-head">
            <h2 id="timeline-title">{activeMaterial.name}</h2>
            <span className="panel-hint">按生成时间排列 · 点击版本查看详情</span>
          </header>
          <VersionTimeline
            material={activeMaterial}
            selectedVersionId={activeVersion.id}
            onSelectVersion={onSelectVersion}
          />
          <footer className="panel-footer">
            <span>修改摘要来自变更记录</span>
            <span>{activeMaterial.versions.length} 个版本</span>
          </footer>
        </section>

        <VersionDetail material={activeMaterial} version={activeVersion} />
      </div>
    </section>
  )
}
