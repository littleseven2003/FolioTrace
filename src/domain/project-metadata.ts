/** 与 schemas/project.schema.json（schemaVersion=1）对应的项目元数据模型。 */

export type FileRole = 'reference' | 'process' | 'output' | 'excluded' | 'unclassified'

export interface ProjectFileRecord {
  id: string
  relativePath: string
  role: FileRole
  sha256: string
}

export interface ProjectDocumentRecord {
  id: string
  name: string
  currentVersionId: string | null
}

export interface ReferencePin {
  fileId: string
  relativePath: string
  sha256: string
}

export interface ProjectVersionRecord {
  id: string
  documentId: string
  fileId: string
  parentVersionId: string | null
  createdAt: string
  summary: string[]
  sha256: string
  referencePins: ReferencePin[]
  producer: string
}

export interface ProjectRelationRecord {
  id: string
  kind: 'companion'
  fromVersionId: string
  toVersionId: string
  label: string
}

export type TaskStatus = 'awaiting-output' | 'has-output' | 'confirmed' | 'cancelled'

export interface ProjectTaskRecord {
  taskId: string
  relativePath: string
  status: TaskStatus
}

export interface ImportedEventRecord {
  eventId: string
  sha256: string
  importedAt: string
}

export interface ProjectMetadata {
  schemaVersion: 1
  projectId: string
  name: string
  revision: number
  files: ProjectFileRecord[]
  documents: ProjectDocumentRecord[]
  versions: ProjectVersionRecord[]
  relations: ProjectRelationRecord[]
  tasks: ProjectTaskRecord[]
  importedEvents: ImportedEventRecord[]
}

/** 仅由用户主动初始化时调用；扫描结果不会写入这里。 */
export function createInitialProjectMetadata(options: {
  projectId: string
  name: string
}): ProjectMetadata {
  return {
    schemaVersion: 1,
    projectId: options.projectId,
    name: options.name,
    revision: 1,
    files: [],
    documents: [],
    versions: [],
    relations: [],
    tasks: [],
    importedEvents: []
  }
}
