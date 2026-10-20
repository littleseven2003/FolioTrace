import type { JSX } from 'react'
import { getCurrentVersion } from '../../../../shared/project'
import type { Material, MaterialVersion } from '../../../../shared/project'
import { formatGeneratedAt } from '../../lib/format'
import { VersionBadges } from './VersionBadges'

interface VersionDetailProps {
  material: Material
  version: MaterialVersion
}

export function VersionDetail({ material, version }: VersionDetailProps): JSX.Element {
  const currentVersion = getCurrentVersion(material)

  return (
    <aside className="panel version-detail" aria-labelledby="version-detail-title">
      <div className="detail-body">
        <p className="detail-kicker">VERSION DETAILS</p>
        <div className="detail-title-row">
          <h2 id="version-detail-title">{version.label}</h2>
          <VersionBadges material={material} version={version} />
        </div>
        <p className="filename mono">{version.fileName}</p>

        <dl className="detail-rows">
          <div>
            <dt>基础版本</dt>
            <dd>{version.baseVersionLabel}</dd>
          </div>
          <div>
            <dt>记录来源</dt>
            <dd>{version.author}</dd>
          </div>
          <div>
            <dt>生成时间</dt>
            <dd>{formatGeneratedAt(version.generatedAt)}</dd>
          </div>
        </dl>

        <h3 className="section-title">本次修改</h3>
        <ul className="summary-list">
          {version.summary.map((item, index) => (
            <li key={`${version.id}-${index}`}>{item}</li>
          ))}
        </ul>

        <div className="adoption-note" role="note">
          <strong>采用状态本轮只读</strong>
          <p>
            当前采用：{currentVersion?.label ?? '未设置'}。最新生成版本不会自动成为当前采用版本。
          </p>
        </div>

        <p className="detail-footnote">模拟数据 · 不写入业务文件</p>
      </div>
    </aside>
  )
}
