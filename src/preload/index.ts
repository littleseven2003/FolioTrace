import { contextBridge, ipcRenderer } from 'electron'
import type { FolioApi, RuntimeInfo } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'
import type { ProjectSnapshot } from '../shared/project'

/**
 * 只暴露白名单业务方法；不暴露 ipcRenderer、fs、child_process 等能力。
 */
const folio: FolioApi = {
  getRuntimeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeInfo) as Promise<RuntimeInfo>,
  getProjectSnapshot: () =>
    ipcRenderer.invoke(IPC_CHANNELS.projectSnapshot) as Promise<ProjectSnapshot>
}

contextBridge.exposeInMainWorld('folio', folio)
