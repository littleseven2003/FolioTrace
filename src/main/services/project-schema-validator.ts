import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import projectSchema from '../../../schemas/project.schema.json'
import type { ProjectMetadata } from '../../domain/project-metadata'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)

const validate = ajv.compile<ProjectMetadata>(projectSchema)

/** 仅做 schema 语法校验；ID/引用/路径等业务不变量由服务层另行验证。 */
export function validateProjectMetadata(value: unknown): value is ProjectMetadata {
  return validate(value)
}
