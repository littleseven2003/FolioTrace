import type { ProjectSnapshot } from '../../shared/project'

export interface ProjectRepository {
  getSnapshot(): ProjectSnapshot
}
