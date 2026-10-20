import { contextBridge, ipcRenderer } from 'electron'
import type { ChooseProjectOutcome, ProjectScan } from '../shared/files'
import type { FolioApi, RuntimeInfo } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'
import type { ProjectSnapshot } from '../shared/project'
import { ERROR_MESSAGES, fail, type Result } from '../shared/result'

async function invoke<T>(
  channel: string,
  failureMessage: string,
  ...args: unknown[]
): Promise<Result<T>> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  } catch {
    // IPC 通道异常时不把底层错误文本暴露给 renderer。
    return fail('INTERNAL_ERROR', failureMessage)
  }
}

/**
 * 只暴露白名单业务方法；不暴露 ipcRenderer、fs、child_process 等能力。
 */
const folio: FolioApi = {
  getRuntimeInfo: () =>
    invoke<RuntimeInfo>(IPC_CHANNELS.runtimeInfo, ERROR_MESSAGES.runtimeUnavailable),
  getProjectSnapshot: () =>
    invoke<ProjectSnapshot>(IPC_CHANNELS.projectSnapshot, ERROR_MESSAGES.snapshotUnavailable),
  chooseProject: () =>
    invoke<ChooseProjectOutcome>(IPC_CHANNELS.projectChoose, ERROR_MESSAGES.projectOpenFailed),
  scanProject: (handle) =>
    invoke<ProjectScan>(IPC_CHANNELS.filesScan, ERROR_MESSAGES.scanFailed, handle)
}

contextBridge.exposeInMainWorld('folio', folio)
