import type { FolioApi } from '../../shared/ipc'

declare global {
  interface Window {
    folio: FolioApi
  }
}

export {}
