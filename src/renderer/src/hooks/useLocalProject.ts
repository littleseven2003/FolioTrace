import { useCallback, useState } from 'react'
import type { ProjectScan, ProjectSummary } from '../../../shared/files'
import { ERROR_MESSAGES } from '../../../shared/result'

export interface LocalProjectState {
  project: ProjectSummary | null
  scan: ProjectScan | null
  choosing: boolean
  scanning: boolean
  error: string | null
  notice: string | null
}

export interface LocalProjectActions {
  chooseProject: () => Promise<void>
  rescan: () => Promise<void>
}

const INITIAL_STATE: LocalProjectState = {
  project: null,
  scan: null,
  choosing: false,
  scanning: false,
  error: null,
  notice: null
}

/** 管理真实目录的会话授权与只读扫描；不保存文件系统能力到 renderer。 */
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
        error: null
      }))
      await scan(project)
    } catch {
      setState((current) => ({
        ...current,
        choosing: false,
        error: ERROR_MESSAGES.projectOpenFailed
      }))
    }
  }, [scan])

  const rescan = useCallback(async (): Promise<void> => {
    if (!state.project) return
    await scan(state.project)
  }, [scan, state.project])

  return { ...state, chooseProject, rescan }
}
