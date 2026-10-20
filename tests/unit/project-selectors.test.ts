import { describe, expect, it } from 'vitest'
import {
  getCurrentVersion,
  getLatestVersion,
  getVersionById,
  isCurrentVersion,
  isLatestVersion,
  sortVersionsByNewest
} from '../../src/domain/project'
import { createDemoProjectSnapshot } from '../../src/main/mocks/demo-project'

const snapshot = createDemoProjectSnapshot()
const ppt = snapshot.materials.find((material) => material.id === 'ppt')!

describe('版本选择器', () => {
  it('按生成时间从新到旧排序', () => {
    expect(sortVersionsByNewest(ppt.versions).map((version) => version.label)).toEqual([
      '第三版',
      '第二版',
      '第一版'
    ])
  })

  it('区分最新生成版本与当前采用版本', () => {
    const latest = getLatestVersion(ppt)
    const current = getCurrentVersion(ppt)

    expect(latest?.id).toBe('ppt-v3')
    expect(current?.id).toBe('ppt-v2')
    expect(isLatestVersion(ppt, 'ppt-v3')).toBe(true)
    expect(isLatestVersion(ppt, 'ppt-v2')).toBe(false)
    expect(isCurrentVersion(ppt, 'ppt-v2')).toBe(true)
    expect(isCurrentVersion(ppt, 'ppt-v3')).toBe(false)
  })

  it('可以按 ID 取到指定版本，未知 ID 返回 undefined', () => {
    expect(getVersionById(ppt, 'ppt-v1')?.label).toBe('第一版')
    expect(getVersionById(ppt, 'missing-version')).toBeUndefined()
  })
})
