import { describe, expect, it } from 'vitest'
import { getCurrentVersion, getLatestVersion } from '../../src/domain/project'
import { MockProjectRepository } from '../../src/main/services/mock-repository'

describe('MockProjectRepository', () => {
  it('返回三份产出材料的模拟项目快照', () => {
    const snapshot = new MockProjectRepository().getSnapshot()

    expect(snapshot.projectName).toBe('年度成果汇报')
    expect(snapshot.revision).toBeGreaterThan(0)
    expect(snapshot.materials.map((material) => material.name)).toEqual([
      '成果汇报 PPT',
      '配套详细报告',
      '汇报演讲稿'
    ])
  })

  it('最新版本不会自动成为当前采用版本', () => {
    const snapshot = new MockProjectRepository().getSnapshot()
    const ppt = snapshot.materials.find((material) => material.id === 'ppt')

    expect(ppt).toBeDefined()
    if (!ppt) return

    expect(getLatestVersion(ppt)?.label).toBe('第三版')
    expect(getCurrentVersion(ppt)?.label).toBe('第二版')
    expect(getLatestVersion(ppt)?.id).not.toBe(ppt.currentVersionId)
    expect(getLatestVersion(ppt)?.status).toBe('pending')
  })

  it('每次返回独立快照，调用方修改不会污染后续读取', () => {
    const repository = new MockProjectRepository()
    const first = repository.getSnapshot()
    first.projectName = '被修改的项目'
    first.materials[0]!.name = '被修改的材料'

    const second = repository.getSnapshot()

    expect(second.projectName).toBe('年度成果汇报')
    expect(second.materials[0]?.name).toBe('成果汇报 PPT')
  })
})
