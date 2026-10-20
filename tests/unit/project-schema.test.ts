import { describe, expect, it } from 'vitest'
import fixture from '../../examples/demo-project/.docwork/project.json'
import { validateProjectMetadata } from '../../src/main/services/project-schema-validator'

describe('project schema validator', () => {
  it('接受现有合成 fixture', () => {
    expect(validateProjectMetadata(fixture)).toBe(true)
  })

  it('拒绝缺字段或错误角色', () => {
    expect(validateProjectMetadata({ schemaVersion: 1 })).toBe(false)
    expect(
      validateProjectMetadata({
        ...fixture,
        files: [{ ...fixture.files[0], role: 'unknown-role' }]
      })
    ).toBe(false)
  })
})
