import { useCallback, useState } from 'react'
import {
  FILE_ROLE_LABELS,
  type FileRole,
  type ProjectMetadataState,
  type ProjectScan,
  type ProjectSummary
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
  classifyingPath: string | null
  error: string | null
  metadataError: string | null
  notice: string | null
}

export interface LocalProjectActions {
  chooseProject: () => Promise<void>
  rescan: () => Promise<void>
  initializeProject: () => Promise<void>
  reloadMetadata: () => Promise<void>
  classifyFile: (relativePath: string, role: FileRole) => Promise<void>
}

const INITIAL_STATE: LocalProjectState = {
  project: null,
  scan: null,
  metadata: null,
  choosing: false,
  scanning: false,
  metadataLoading: false,
  initializing: false,
  classifyingPath: null,
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
      // 初始化后重新读取完整元数据（含已登记文件），已有项目不会丢失用途。
      await loadMetadata(project)
      setState((current) => ({
        ...current,
        initializing: false,
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
  }, [loadMetadata, state.project])

  const reloadMetadata = useCallback(async (): Promise<void> => {
    if (!state.project) return
    await loadMetadata(state.project)
  }, [loadMetadata, state.project])

  const classifyFile = useCallback(
    async (relativePath: string, role: FileRole): Promise<void> => {
      const project = state.project
      const metadata = state.metadata
      if (!project || !metadata || metadata.status !== 'loaded') return

      const expectedRevision = metadata.summary.revision
      setState((current) => ({ ...current, classifyingPath: relativePath, metadataError: null }))
      try {
        const result = await window.folio.classifyProjectFile(project.handle, {
          relativePath,
          role,
          expectedRevision
        })

        if (!result.ok) {
          // 冲突或其他写入失败都保留当前展示，提示用户重新读取，不静默覆盖。
          setState((current) => ({
            ...current,
            classifyingPath: null,
            metadataError: result.error.message,
            notice: null
          }))
          return
        }

        const outcome = result.value
        setState((current) => {
          if (!current.metadata || current.metadata.status !== 'loaded') {
            return { ...current, classifyingPath: null }
          }
          const files = current.metadata.files
            .filter((file) => file.relativePath !== outcome.file.relativePath)
            .concat(outcome.file)
            .sort((left, right) => left.relativePath.localeCompare(right.relativePath))

          return {
            ...current,
            classifyingPath: null,
            metadataError: null,
            metadata: {
              status: 'loaded',
              summary: {
                ...current.metadata.summary,
                revision: outcome.revision,
                fileCount: files.length
              },
              files
            },
            notice: outcome.contentChanged
              ? '用途已保存；文件内容已变化，保留上次登记的指纹。'
              : `已保存“${FILE_ROLE_LABELS[outcome.file.role]}”（revision ${outcome.revision}）。`
          }
        })
      } catch {
        setState((current) => ({
          ...current,
          classifyingPath: null,
          metadataError: ERROR_MESSAGES.metadataWriteFailed
        }))
      }
    },
    [state.metadata, state.project]
  )

  return { ...state, chooseProject, rescan, initializeProject, reloadMetadata, classifyFile }
}
