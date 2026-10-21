/** M2 第一小步：真实项目的只读文件清单与目录授权。 */

export type FileClassification = 'unclassified'

/** 文件用途，与 schemas/project.schema.json 的 File.role 一致。 */
export type FileRole = 'reference' | 'process' | 'output' | 'excluded' | 'unclassified'

export const FILE_ROLE_LABELS: Readonly<Record<FileRole, string>> = {
  reference: '参考资料',
  process: '过程文件',
  output: '产出材料',
  excluded: '排除',
  unclassified: '未分类'
}

export const FILE_ROLES: readonly FileRole[] = [
  'reference',
  'process',
  'output',
  'excluded',
  'unclassified'
]

/** 已登记文件：ID 与 SHA-256 由主进程生成/计算，renderer 只读展示。 */
export interface ProjectFileClassification {
  id: string
  relativePath: string
  role: FileRole
  sha256: string
}

export interface ClassifyFileInput {
  relativePath: string
  role: FileRole
  expectedRevision: number
}

export interface ClassifyFileOutcome {
  file: ProjectFileClassification
  revision: number
  /** 已登记文件内容与记录指纹不一致时为 true；此时保留原指纹。 */
  contentChanged: boolean
}

export type FileCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'text'
  | 'image'
  | 'other'

export interface ProjectSummary {
  /** 主进程生成的会话 handle；renderer 不持有绝对根路径。 */
  handle: string
  name: string
  openedAt: string
  readOnly: true
}

export type ChooseProjectOutcome =
  | { canceled: true }
  | { canceled: false; project: ProjectSummary }

export interface ProjectFileEntry {
  /** 相对项目根目录，使用 / 分隔。 */
  relativePath: string
  /** 大写扩展名；无扩展名时为“无扩展名”。 */
  type: string
  category: FileCategory
  sizeBytes: number
  modifiedAt: string
  classification: FileClassification
}

export type ScanWarningCode =
  | 'PERMISSION_DENIED'
  | 'ENTRY_DISAPPEARED'
  | 'PATH_OUTSIDE_ROOT'
  | 'UNREADABLE_DIRECTORY'
  | 'SCAN_ABORTED'

export interface ScanWarning {
  code: ScanWarningCode
  relativePath: string
  message: string
}

export interface ProjectScan {
  handle: string
  scannedAt: string
  files: ProjectFileEntry[]
  warnings: ScanWarning[]
}

/** 项目元数据摘要：仅用于界面展示，不包含完整文件/版本数据。 */
export interface ProjectMetadataSummary {
  projectId: string
  name: string
  revision: number
  schemaVersion: 1
  fileCount: number
  documentCount: number
  versionCount: number
  relationCount: number
}

export type ProjectMetadataState =
  | { status: 'none' }
  | { status: 'loaded'; summary: ProjectMetadataSummary; files: ProjectFileClassification[] }

export interface InitializeProjectOutcome {
  status: 'created' | 'existing'
  summary: ProjectMetadataSummary
}
