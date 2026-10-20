import type { JSX } from 'react'
import { sortVersionsByNewest } from '../../../../shared/project'
import type { Material, MaterialVersion } from '../../../../shared/project'
import { formatGeneratedAt } from '../../lib/format'
import { VersionBadges } from './VersionBadges'

interface VersionTimelineProps {
  material: Material
  selectedVersionId: string
  onSelectVersion: (version: MaterialVersion) => void
}

export function VersionTimeline({
  material,
  selectedVersionId,
  onSelectVersion
}: VersionTimelineProps): JSX.Element {
  const versions = sortVersionsByNewest(material.versions)

  return (
    <ol className="timeline" aria-label={`${material.name} 的版本时间线`}>
      {versions.map((version) => {
        const selected = version.id === selectedVersionId
        return (
          <li key={version.id} className={`timeline-item ${selected ? 'is-selected' : ''}`}>
            <span className="timeline-dot" aria-hidden="true" />
            <button
              type="button"
              className="version-card"
              aria-pressed={selected}
              aria-label={`${material.name} ${version.label}，${formatGeneratedAt(version.generatedAt)}`}
              onClick={() => onSelectVersion(version)}
            >
              <span className="version-heading">
                <strong>{version.label}</strong>
                <VersionBadges material={material} version={version} />
                <time dateTime={version.generatedAt}>
                  {formatGeneratedAt(version.generatedAt)}
                </time>
              </span>
              <span className="version-summary">{version.summary[0]}</span>
              <span className="version-meta">
                由 {version.author} 登记 · 基于 {version.baseVersionLabel}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
