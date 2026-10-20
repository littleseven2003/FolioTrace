import type { RuntimeInfo } from '../../shared/ipc'
import type { ProjectSnapshot } from '../../shared/project'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'
import type { ProjectRepository } from '../services/project-repository'
import { validateIpcCaller, type IpcCaller, type TrustedRenderer } from './trust'

export function respondProjectSnapshot(
  caller: IpcCaller,
  trusted: TrustedRenderer | null,
  repository: ProjectRepository
): Result<ProjectSnapshot> {
  const callerCheck = validateIpcCaller(caller, trusted)
  if (!callerCheck.ok) {
    return fail(callerCheck.error.code, callerCheck.error.message)
  }

  try {
    return ok(repository.getSnapshot())
  } catch (error) {
    // 内部异常只写主进程日志；界面收到固定、可读的消息。
    console.error('[ipc] 读取项目快照失败：', error)
    return fail('INTERNAL_ERROR', ERROR_MESSAGES.snapshotUnavailable)
  }
}

export function respondRuntimeInfo(
  caller: IpcCaller,
  trusted: TrustedRenderer | null,
  runtime: RuntimeInfo
): Result<RuntimeInfo> {
  const callerCheck = validateIpcCaller(caller, trusted)
  if (!callerCheck.ok) {
    return fail(callerCheck.error.code, callerCheck.error.message)
  }

  return ok(runtime)
}
