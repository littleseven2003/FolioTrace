import { randomUUID } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { ProjectSummary } from '../../shared/files'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'

export interface AuthorizedProject {
  project: ProjectSummary
  /** 仅保存在主进程，不通过 IPC 返回。 */
  rootPath: string
}

function permissionDenied(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return code === 'EACCES' || code === 'EPERM'
}

/** 会话内目录授权表：renderer 只能凭 handle 触发扫描。 */
export class ProjectRegistry {
  private readonly projects = new Map<string, AuthorizedProject>()

  async authorize(rootPath: string): Promise<Result<ProjectSummary>> {
    if (typeof rootPath !== 'string' || rootPath.length === 0) {
      return fail('INVALID_PROJECT_PATH', ERROR_MESSAGES.invalidProjectPath)
    }

    try {
      const canonicalRoot = await realpath(rootPath)
      const stats = await stat(canonicalRoot)
      if (!stats.isDirectory()) {
        return fail('INVALID_PROJECT_PATH', ERROR_MESSAGES.invalidProjectPath)
      }

      const project: ProjectSummary = {
        handle: `project-${randomUUID()}`,
        name: basename(canonicalRoot),
        openedAt: new Date().toISOString(),
        readOnly: true
      }
      this.projects.set(project.handle, { project, rootPath: canonicalRoot })
      return ok(project)
    } catch (error) {
      if (permissionDenied(error)) {
        return fail('PERMISSION_DENIED', ERROR_MESSAGES.permissionDenied)
      }
      return fail('INVALID_PROJECT_PATH', ERROR_MESSAGES.invalidProjectPath)
    }
  }

  resolve(handle: string): Result<AuthorizedProject> {
    if (typeof handle !== 'string' || handle.length === 0) {
      return fail('PROJECT_NOT_FOUND', ERROR_MESSAGES.projectNotFound)
    }

    const project = this.projects.get(handle)
    if (!project) {
      return fail('PROJECT_NOT_FOUND', ERROR_MESSAGES.projectNotFound)
    }
    return ok(project)
  }
}
