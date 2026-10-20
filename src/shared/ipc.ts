/**
 * main、preload 与 renderer 共享的最小 IPC 契约。
 * renderer 只能通过 preload 暴露的 window.folio 调用这些方法。
 */
export const IPC_CHANNELS = {
  runtimeInfo: 'runtime:get-info'
} as const

export interface RuntimeInfo {
  appName: string
  appVersion: string
  electronVersion: string
  chromeVersion: string
}

export interface FolioApi {
  getRuntimeInfo(): Promise<RuntimeInfo>
}
