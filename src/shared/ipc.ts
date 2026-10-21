import type {
  ChooseProjectOutcome,
  ClassifyFileInput,
  ClassifyFileOutcome,
  InitializeProjectOutcome,
  ProjectMetadataState,
  ProjectScan
} from './files'
import type { ProjectSnapshot } from './project'
import type { Result } from './result'

/**
 * main、preload 与 renderer 共享的最小 IPC 契约。
 * renderer 只能通过 preload 暴露的 window.folio 调用这些方法。
 */
export const IPC_CHANNELS = {
  runtimeInfo: 'runtime:get-info',
  projectSnapshot: 'project:get-snapshot',
  projectChoose: 'project:choose',
  projectGetMetadata: 'project:get-metadata',
  projectInitialize: 'project:initialize',
  filesScan: 'files:scan',
  filesClassify: 'files:classify'
} as const

export interface RuntimeInfo {
  appName: string
  appVersion: string
  electronVersion: string
  chromeVersion: string
}

export interface FolioApi {
  getRuntimeInfo(): Promise<Result<RuntimeInfo>>
  getProjectSnapshot(): Promise<Result<ProjectSnapshot>>
  chooseProject(): Promise<Result<ChooseProjectOutcome>>
  getProjectMetadata(handle: string): Promise<Result<ProjectMetadataState>>
  initializeProject(handle: string): Promise<Result<InitializeProjectOutcome>>
  scanProject(handle: string): Promise<Result<ProjectScan>>
  classifyProjectFile(
    handle: string,
    input: ClassifyFileInput
  ): Promise<Result<ClassifyFileOutcome>>
}
