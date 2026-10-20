import { useCallback, useEffect, useState } from 'react'
import type { ProjectSnapshot } from '../../../shared/project'

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
      .then((snapshot) => {
        if (active) setState({ status: 'ready', snapshot, error: null })
      })
      .catch((cause: unknown) => {
        if (!active) return
        const message = cause instanceof Error ? cause.message : '未知错误'
        setState({ status: 'error', snapshot: null, error: message })
      })

    return () => {
      active = false
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((current) => current + 1), [])

  return { ...state, reload }
}
