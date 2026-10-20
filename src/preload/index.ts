import { contextBridge, ipcRenderer } from 'electron'
import type { FolioApi, RuntimeInfo } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'
import type { ProjectSnapshot } from '../shared/project'
import { ERROR_MESSAGES, fail, type Result } from '../shared/result'

async function invoke<T>(channel: string, failureMessage: string): Promise<Result<T>> {
  try {
    return (await ipcRenderer.invoke(channel)) as Result<T>
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
    invoke<ProjectSnapshot>(IPC_CHANNELS.projectSnapshot, ERROR_MESSAGES.snapshotUnavailable)
}

contextBridge.exposeInMainWorld('folio', folio)
