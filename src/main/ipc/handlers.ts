import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { APP_TITLE } from '../../shared/app'
import type { RuntimeInfo } from '../../shared/ipc'
import { IPC_CHANNELS } from '../../shared/ipc'
import type { ProjectSnapshot } from '../../shared/project'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'
import type { ProjectRepository } from '../services/project-repository'
import { isTrustedRendererUrl } from './trust'

function isTrustedEvent(event: IpcMainInvokeEvent): boolean {
  return Boolean(event.senderFrame && isTrustedRendererUrl(event.senderFrame.url))
}

export function registerIpcHandlers(repository: ProjectRepository): void {
  ipcMain.handle(IPC_CHANNELS.runtimeInfo, (event): Result<RuntimeInfo> => {
    if (!isTrustedEvent(event)) {
      return fail('UNTRUSTED_SOURCE', ERROR_MESSAGES.untrustedSource)
    }

    try {
      return ok({
        appName: APP_TITLE,
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome
      })
    } catch (error) {
      console.error('[ipc] 读取运行时信息失败：', error)
      return fail('INTERNAL_ERROR', ERROR_MESSAGES.runtimeUnavailable)
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectSnapshot, (event): Result<ProjectSnapshot> => {
    if (!isTrustedEvent(event)) {
      return fail('UNTRUSTED_SOURCE', ERROR_MESSAGES.untrustedSource)
    }

    try {
      return ok(repository.getSnapshot())
    } catch (error) {
      console.error('[ipc] 读取项目快照失败：', error)
      return fail('INTERNAL_ERROR', ERROR_MESSAGES.snapshotUnavailable)
    }
  })
}
