import type { JSX } from 'react'
import { isCurrentVersion, isLatestVersion } from '../../../../shared/project'
import type { Material, MaterialVersion } from '../../../../shared/project'

interface VersionBadgesProps {
  material: Material
  version: MaterialVersion
}

export function VersionBadges({ material, version }: VersionBadgesProps): JSX.Element {
  const latest = isLatestVersion(material, version.id)
  const current = isCurrentVersion(material, version.id)
  const history = !latest && !current && version.status !== 'pending'

  return (
    <span className="badges">
      {latest && <span className="badge badge-latest">最新生成</span>}
      {current && <span className="badge badge-current">当前采用</span>}
      {version.status === 'pending' && <span className="badge badge-pending">待确认</span>}
      {history && <span className="badge badge-muted">历史版本</span>}
    </span>
  )
}
