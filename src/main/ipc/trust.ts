import type { IpcMainInvokeEvent } from 'electron'
import { pathToFileURL } from 'node:url'
import { ERROR_MESSAGES, fail, ok, type Result } from '../../shared/result'

/**
 * 可信调用方 = 主窗口的 main frame，且页面 URL 属于应用实际入口。
 * 生产只信任实际加载的 index.html；开发只信任配置的开发服务器来源。
 */
export interface TrustedRenderer {
  webContentsId: number
  frameProcessId: number
  frameRoutingId: number
  entryUrl: string
  devServerUrl: string | null
}

export interface IpcCaller {
  webContentsId: number
  frameProcessId: number | null
  frameRoutingId: number | null
  frameUrl: string | undefined
}

export interface TrustedRendererInput {
  webContentsId: number
  frameProcessId: number
  frameRoutingId: number
  devServerUrl: string | null
  productionEntryPath: string
}

export function createTrustedRenderer(input: TrustedRendererInput): TrustedRenderer {
  return {
    webContentsId: input.webContentsId,
    frameProcessId: input.frameProcessId,
    frameRoutingId: input.frameRoutingId,
    entryUrl: input.devServerUrl ?? pathToFileURL(input.productionEntryPath).href,
    devServerUrl: input.devServerUrl
  }
}

export function isTrustedRendererUrl(
  rawUrl: string,
  trusted: Pick<TrustedRenderer, 'entryUrl' | 'devServerUrl'>
): boolean {
  try {
    const candidate = new URL(rawUrl)
    const expected = new URL(trusted.entryUrl)

    if (trusted.devServerUrl) {
      return (
        (candidate.protocol === 'http:' || candidate.protocol === 'https:') &&
        candidate.origin === expected.origin
      )
    }

    // 生产不能只判断 file:，必须与主进程实际加载的入口路径一致。
    return (
      candidate.protocol === 'file:' &&
      candidate.host === '' &&
      candidate.pathname === expected.pathname
    )
  } catch {
    return false
  }
}

export function validateIpcCaller(
  caller: IpcCaller,
  trusted: TrustedRenderer | null
): Result<void> {
  if (!trusted) {
    return fail('UNTRUSTED_SOURCE', ERROR_MESSAGES.untrustedSource)
  }

  if (caller.webContentsId !== trusted.webContentsId) {
    return fail('UNTRUSTED_SOURCE', ERROR_MESSAGES.untrustedSource)
  }

  const sameMainFrame =
    caller.frameProcessId !== null &&
    caller.frameRoutingId !== null &&
    caller.frameProcessId === trusted.frameProcessId &&
    caller.frameRoutingId === trusted.frameRoutingId
  if (!sameMainFrame) {
    return fail('UNTRUSTED_SOURCE', ERROR_MESSAGES.untrustedSource)
  }

  if (!caller.frameUrl || !isTrustedRendererUrl(caller.frameUrl, trusted)) {
    return fail('UNTRUSTED_SOURCE', ERROR_MESSAGES.untrustedSource)
  }

  return ok(undefined)
}

export function toIpcCaller(event: IpcMainInvokeEvent): IpcCaller {
  const frame = event.senderFrame
  return {
    webContentsId: event.sender.id,
    frameProcessId: frame?.processId ?? null,
    frameRoutingId: frame?.routingId ?? null,
    frameUrl: frame?.url
  }
}
