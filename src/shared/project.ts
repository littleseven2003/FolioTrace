export type {
  Material,
  MaterialType,
  MaterialVersion,
  MaterialVersionStatus,
  ProjectSnapshot
} from '../domain/project'

export {
  getCurrentVersion,
  getLatestVersion,
  getVersionById,
  isCurrentVersion,
  isLatestVersion,
  sortVersionsByNewest
} from '../domain/project'
