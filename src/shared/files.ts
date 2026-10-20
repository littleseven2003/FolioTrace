/** M2 第一小步：真实项目的只读文件清单与目录授权。 */

export type FileClassification = 'unclassified'

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
  | { status: 'loaded'; summary: ProjectMetadataSummary }

export interface InitializeProjectOutcome {
  status: 'created' | 'existing'
  summary: ProjectMetadataSummary
}
