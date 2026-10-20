import type { ProjectScan } from '../../shared/files'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'
import { scanProjectDirectory } from './file-scanner'
import type { ProjectRegistry } from './project-registry'

export type ScanProject = (handle: string, rootPath: string) => Promise<ProjectScan>

/** 凭 handle 扫描主进程已授权的目录；不接受 renderer 提供的绝对路径。 */
export async function scanAuthorizedProject(
  handle: string,
  registry: ProjectRegistry,
  scanner: ScanProject = scanProjectDirectory
): Promise<Result<ProjectScan>> {
  const resolved = registry.resolve(handle)
  if (!resolved.ok) {
    return fail(resolved.error.code, resolved.error.message)
  }

  try {
    return ok(await scanner(handle, resolved.value.rootPath))
  } catch (error) {
    console.error('[scan] 扫描项目文件失败：', error)
    return fail('INTERNAL_ERROR', ERROR_MESSAGES.scanFailed)
  }
}
