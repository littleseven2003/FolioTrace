import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions
} from 'electron'
import { APP_TITLE } from '../../shared/app'
import type {
  ChooseProjectOutcome,
  InitializeProjectOutcome,
  ProjectMetadataState,
  ProjectScan
} from '../../shared/files'
import { IPC_CHANNELS } from '../../shared/ipc'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'
import type { ProjectMetadataStore, AuthorizedRoot } from '../services/project-metadata-store'
import type { ProjectRegistry } from '../services/project-registry'
import { scanAuthorizedProject } from '../services/project-service'
import type { ProjectRepository } from '../services/project-repository'
import { respondProjectSnapshot, respondRuntimeInfo } from './respond'
import { toIpcCaller, validateIpcCaller, type TrustedRenderer } from './trust'

interface IpcHandlerOptions {
  repository: ProjectRepository
  projectRegistry: ProjectRegistry
  metadataStore: ProjectMetadataStore
  getTrustedRenderer: () => TrustedRenderer | null
}

function validateCaller(
  event: IpcMainInvokeEvent,
  getTrustedRenderer: () => TrustedRenderer | null
): Result<void> {
  return validateIpcCaller(toIpcCaller(event), getTrustedRenderer())
}

function validateHandle(handle: unknown): Result<string> {
  if (typeof handle !== 'string' || handle.length === 0 || handle.length > 128) {
    return fail('PROJECT_NOT_FOUND', ERROR_MESSAGES.projectNotFound)
  }
  return ok(handle)
}

function resolveAuthorizedProject(
  handle: string,
  projectRegistry: ProjectRegistry
): Result<AuthorizedRoot> {
  const resolved = projectRegistry.resolve(handle)
  if (!resolved.ok) {
    return fail(resolved.error.code, resolved.error.message)
  }
  return ok({
    rootPath: resolved.value.rootPath,
    identity: resolved.value.rootIdentity
  })
}

async function chooseProject(
  event: IpcMainInvokeEvent,
  projectRegistry: ProjectRegistry
): Promise<Result<ChooseProjectOutcome>> {
  const parentWindow = BrowserWindow.fromWebContents(event.sender)
  const dialogOptions: OpenDialogOptions = {
    title: '选择要接入的文件夹',
    buttonLabel: '接入文件夹',
    properties: ['openDirectory']
  }

  try {
    const selection = parentWindow
      ? await dialog.showOpenDialog(parentWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (selection.canceled) return ok({ canceled: true })

    const rootPath = selection.filePaths[0]
    if (!rootPath) return ok({ canceled: true })

    const authorized = await projectRegistry.authorize(rootPath)
    if (!authorized.ok) {
      return fail(authorized.error.code, authorized.error.message)
    }

    return ok({ canceled: false, project: authorized.value })
  } catch (error) {
    console.error('[project] 选择文件夹失败：', error)
    return fail('INTERNAL_ERROR', ERROR_MESSAGES.projectOpenFailed)
  }
}

export function registerIpcHandlers({
  repository,
  projectRegistry,
  metadataStore,
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

  ipcMain.handle(IPC_CHANNELS.projectChoose, async (event): Promise<Result<ChooseProjectOutcome>> => {
    const callerCheck = validateCaller(event, getTrustedRenderer)
    if (!callerCheck.ok) {
      return fail(callerCheck.error.code, callerCheck.error.message)
    }
    return chooseProject(event, projectRegistry)
  })

  ipcMain.handle(
    IPC_CHANNELS.projectGetMetadata,
    async (event, handle: unknown): Promise<Result<ProjectMetadataState>> => {
      const callerCheck = validateCaller(event, getTrustedRenderer)
      if (!callerCheck.ok) {
        return fail(callerCheck.error.code, callerCheck.error.message)
      }
      const handleCheck = validateHandle(handle)
      if (!handleCheck.ok) return handleCheck
      const rootCheck = resolveAuthorizedProject(handleCheck.value, projectRegistry)
      if (!rootCheck.ok) return rootCheck
      return metadataStore.getState(rootCheck.value)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.projectInitialize,
    async (event, handle: unknown): Promise<Result<InitializeProjectOutcome>> => {
      const callerCheck = validateCaller(event, getTrustedRenderer)
      if (!callerCheck.ok) {
        return fail(callerCheck.error.code, callerCheck.error.message)
      }
      const handleCheck = validateHandle(handle)
      if (!handleCheck.ok) return handleCheck
      const rootCheck = resolveAuthorizedProject(handleCheck.value, projectRegistry)
      if (!rootCheck.ok) return rootCheck
      return metadataStore.initializeProject(rootCheck.value)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.filesScan,
    async (event, handle: unknown): Promise<Result<ProjectScan>> => {
      const callerCheck = validateCaller(event, getTrustedRenderer)
      if (!callerCheck.ok) {
        return fail(callerCheck.error.code, callerCheck.error.message)
      }
      const handleCheck = validateHandle(handle)
      if (!handleCheck.ok) return handleCheck
      const rootCheck = resolveAuthorizedProject(handleCheck.value, projectRegistry)
      if (!rootCheck.ok) return rootCheck
      return scanAuthorizedProject(rootCheck.value.rootPath, projectRegistry)
    }
  )
}
