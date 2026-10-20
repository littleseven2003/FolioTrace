import type { ProjectSnapshot } from '../../shared/project'
import { createDemoProjectSnapshot } from '../mocks/demo-project'
import type { ProjectRepository } from './project-repository'

/** 只读模拟仓库：每次返回独立快照，避免调用方修改影响后续读取。 */
export class MockProjectRepository implements ProjectRepository {
  getSnapshot(): ProjectSnapshot {
    return structuredClone(createDemoProjectSnapshot())
  }
}
