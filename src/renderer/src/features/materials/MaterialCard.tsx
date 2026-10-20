import type { JSX } from 'react'
import { getCurrentVersion } from '../../../../shared/project'
import type { Material } from '../../../../shared/project'
import { ArrowUpRightIcon } from '../../components/Icons'

interface MaterialCardProps {
  material: Material
  selected: boolean
  onSelect: (material: Material) => void
}

export function MaterialCard({ material, selected, onSelect }: MaterialCardProps): JSX.Element {
  const currentVersion = getCurrentVersion(material)

  return (
    <button
      type="button"
      className={`material-card ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(material)}
    >
      <span className={`material-type type-${material.type.toLowerCase()}`}>{material.type}</span>
      <span className="material-copy">
        <strong>{material.name}</strong>
        <small>
          {material.versions.length} 个已登记版本 · {currentVersion?.label ?? '未设置'}采用中
        </small>
      </span>
      <ArrowUpRightIcon className="material-arrow" />
    </button>
  )
}
