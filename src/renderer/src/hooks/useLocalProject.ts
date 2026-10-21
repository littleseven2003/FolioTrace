import { useCallback, useState } from 'react'
import type {
  ProjectMetadataState,
  ProjectScan,
  ProjectSummary
} from '../../../shared/files'
import { ERROR_MESSAGES } from '../../../shared/result'

export interface LocalProjectState {
  project: ProjectSummary | null
  scan: ProjectScan | null
  metadata: ProjectMetadataState | null
  choosing: boolean
  scanning: boolean
  metadataLoading: boolean
  initializing: boolean
  error: string | null
  metadataError: string | null
  notice: string | null
}

export interface LocalProjectActions {
  chooseProject: () => Promise<void>
  rescan: () => Promise<void>
  initializeProject: () => Promise<void>
  reloadMetadata: () => Promise<void>
}

const INITIAL_STATE: LocalProjectState = {
  project: null,
  scan: null,
  metadata: null,
  choosing: false,
  scanning: false,
  metadataLoading: false,
  initializing: false,
  error: null,
  metadataError: null,
  notice: null
}

/** 管理真实目录的会话授权、只读扫描与项目元数据；renderer 不接触文件系统。 */
export function useLocalProject(): LocalProjectState & LocalProjectActions {
  const [state, setState] = useState<LocalProjectState>(INITIAL_STATE)

  const scan = useCallback(async (project: ProjectSummary): Promise<void> => {
    setState((current) => ({ ...current, scanning: true, error: null }))
    try {
      const result = await window.folio.scanProject(project.handle)
      setState((current) => ({
        ...current,
        scanning: false,
        scan: result.ok ? result.value : current.scan,
        error: result.ok ? null : result.error.message
      }))
    } catch {
      setState((current) => ({
        ...current,
        scanning: false,
        error: ERROR_MESSAGES.scanFailed
      }))
    }
  }, [])

  const loadMetadata = useCallback(async (project: ProjectSummary): Promise<void> => {
    setState((current) => ({ ...current, metadataLoading: true, metadataError: null }))
    try {
      const result = await window.folio.getProjectMetadata(project.handle)
      setState((current) =>
        result.ok
          ? {
              ...current,
              metadataLoading: false,
              metadata: result.value,
              metadataError: null
            }
          : {
              ...current,
              metadataLoading: false,
              metadata: null,
              metadataError: result.error.message
            }
      )
    } catch {
      setState((current) => ({
        ...current,
        metadataLoading: false,
        metadata: null,
        metadataError: ERROR_MESSAGES.metadataInvalid
      }))
    }
  }, [])

  const chooseProject = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, choosing: true, error: null, notice: null }))
    try {
      const result = await window.folio.chooseProject()
      if (!result.ok) {
        setState((current) => ({
          ...current,
          choosing: false,
          error: result.error.message
        }))
        return
      }

      if (result.value.canceled) {
        setState((current) => ({
          ...current,
          choosing: false,
          notice: '已取消选择文件夹。'
        }))
        return
      }

      const project = result.value.project
      setState((current) => ({
        ...current,
        choosing: false,
        project,
        scan: null,
        metadata: null,
        metadataLoading: true,
        error: null,
        metadataError: null
      }))
      await Promise.all([scan(project), loadMetadata(project)])
    } catch {
      setState((current) => ({
        ...current,
        choosing: false,
        error: ERROR_MESSAGES.projectOpenFailed
      }))
    }
  }, [loadMetadata, scan])

  const rescan = useCallback(async (): Promise<void> => {
    if (!state.project) return
    await scan(state.project)
  }, [scan, state.project])

  const initializeProject = useCallback(async (): Promise<void> => {
    const project = state.project
    if (!project) return

    setState((current) => ({ ...current, initializing: true, metadataError: null, notice: null }))
    try {
      const result = await window.folio.initializeProject(project.handle)
      if (!result.ok) {
        setState((current) => ({
          ...current,
          initializing: false,
          metadataError: result.error.message
        }))
        return
      }

      const summary = result.value.summary
      setState((current) => ({
        ...current,
        initializing: false,
        metadata: { status: 'loaded', summary, files: [] },
        metadataError: null,
        notice:
          result.value.status === 'created'
            ? `文脉项目已初始化（revision ${summary.revision}）。`
            : `已读取现有文脉项目（revision ${summary.revision}）。`
      }))
    } catch {
      setState((current) => ({
        ...current,
        initializing: false,
        metadataError: ERROR_MESSAGES.metadataWriteFailed
      }))
    }
  }, [state.project])

  const reloadMetadata = useCallback(async (): Promise<void> => {
    if (!state.project) return
    await loadMetadata(state.project)
  }, [loadMetadata, state.project])

  return { ...state, chooseProject, rescan, initializeProject, reloadMetadata }
}
