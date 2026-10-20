/**
 * 领域模型：只包含纯 TypeScript 类型与选择器，不访问文件系统、Electron 或 React。
 * 版本按生成时间排序；currentVersionId 是用户确认的“当前采用”，与最新生成版本无关。
 */

export type MaterialType = 'PPT' | 'DOC' | 'MD'

export type MaterialVersionStatus = 'confirmed' | 'pending'

export interface MaterialVersion {
  id: string
  label: string
  /** ISO 8601 时间，带时区偏移。 */
  generatedAt: string
  fileName: string
  summary: string[]
  baseVersionLabel: string
  author: string
  status: MaterialVersionStatus
}

export interface Material {
  id: string
  name: string
  type: MaterialType
  /** 用户确认的当前采用版本；不随最新生成版本自动改变。 */
  currentVersionId: string
  versions: MaterialVersion[]
}

export interface ProjectSnapshot {
  projectId: string
  projectName: string
  description: string
  revision: number
  fileCount: number
  pendingCount: number
  updatedAt: string
  materials: Material[]
}

/** 按生成时间从新到旧排列；时间相同用 versionId 保证稳定次序。 */
export function sortVersionsByNewest(versions: readonly MaterialVersion[]): MaterialVersion[] {
  return [...versions].sort((left, right) => {
    const delta = Date.parse(right.generatedAt) - Date.parse(left.generatedAt)
    return delta !== 0 ? delta : left.id.localeCompare(right.id)
  })
}

export function getLatestVersion(material: Material): MaterialVersion | undefined {
  return sortVersionsByNewest(material.versions)[0]
}

export function getCurrentVersion(material: Material): MaterialVersion | undefined {
  return material.versions.find((version) => version.id === material.currentVersionId)
}

export function getVersionById(
  material: Material,
  versionId: string
): MaterialVersion | undefined {
  return material.versions.find((version) => version.id === versionId)
}

export function isLatestVersion(material: Material, versionId: string): boolean {
  return getLatestVersion(material)?.id === versionId
}

export function isCurrentVersion(material: Material, versionId: string): boolean {
  return material.currentVersionId === versionId
}
