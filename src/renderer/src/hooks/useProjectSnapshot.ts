import { useCallback, useEffect, useState } from 'react'
import type { ProjectSnapshot } from '../../../shared/project'
import { ERROR_MESSAGES } from '../../../shared/result'

type SnapshotState =
  | { status: 'loading'; snapshot: null; error: null }
  | { status: 'ready'; snapshot: ProjectSnapshot; error: null }
  | { status: 'error'; snapshot: null; error: string }

const INITIAL_STATE: SnapshotState = { status: 'loading', snapshot: null, error: null }

export function useProjectSnapshot(): SnapshotState & { reload: () => void } {
  const [state, setState] = useState<SnapshotState>(INITIAL_STATE)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setState(INITIAL_STATE)

    void window.folio
      .getProjectSnapshot()
      .then((result) => {
        if (!active) return
        if (result.ok) {
          setState({ status: 'ready', snapshot: result.value, error: null })
        } else {
          setState({ status: 'error', snapshot: null, error: result.error.message })
        }
      })
      .catch(() => {
        // 预加载桥接抛出的意外异常只显示统一消息，不展示内部细节。
        if (active) {
          setState({ status: 'error', snapshot: null, error: ERROR_MESSAGES.snapshotUnavailable })
        }
      })

    return () => {
      active = false
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((current) => current + 1), [])

  return { ...state, reload }
}
