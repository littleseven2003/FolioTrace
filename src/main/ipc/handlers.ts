import { app, ipcMain } from 'electron'
import { APP_TITLE } from '../../shared/app'
import { IPC_CHANNELS } from '../../shared/ipc'
import type { ProjectRepository } from '../services/project-repository'
import { respondProjectSnapshot, respondRuntimeInfo } from './respond'
import { toIpcCaller, type TrustedRenderer } from './trust'

interface IpcHandlerOptions {
  repository: ProjectRepository
  getTrustedRenderer: () => TrustedRenderer | null
}

export function registerIpcHandlers({
  repository,
  getTrustedRenderer
}: IpcHandlerOptions): void {
  ipcMain.handle(IPC_CHANNELS.runtimeInfo, (event) =>
    respondRuntimeInfo(toIpcCaller(event), getTrustedRenderer(), {
      appName: APP_TITLE,
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome
    })
  )

  ipcMain.handle(IPC_CHANNELS.projectSnapshot, (event) =>
    respondProjectSnapshot(toIpcCaller(event), getTrustedRenderer(), repository)
  )
}
