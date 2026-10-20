import { app, ipcMain } from 'electron'
import { APP_TITLE } from '../../shared/app'
import type { RuntimeInfo } from '../../shared/ipc'
import { IPC_CHANNELS } from '../../shared/ipc'
import type { ProjectSnapshot } from '../../shared/project'
import type { ProjectRepository } from '../services/project-repository'
import { assertTrustedSender } from './trust'

export function registerIpcHandlers(repository: ProjectRepository): void {
  ipcMain.handle(IPC_CHANNELS.runtimeInfo, (event): RuntimeInfo => {
    assertTrustedSender(event.senderFrame?.url)
    return {
      appName: APP_TITLE,
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectSnapshot, (event): ProjectSnapshot => {
    assertTrustedSender(event.senderFrame?.url)
    return repository.getSnapshot()
  })
}
