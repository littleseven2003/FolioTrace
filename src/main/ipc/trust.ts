const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

/** 只允许开发服务器同源页面或打包后的本地文件。 */
export function isTrustedRendererUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (RENDERER_DEV_URL) {
      return url.origin === new URL(RENDERER_DEV_URL).origin
    }
    return url.protocol === 'file:'
  } catch {
    return false
  }
}

export function assertTrustedSender(senderUrl: string | undefined): void {
  if (!senderUrl || !isTrustedRendererUrl(senderUrl)) {
    throw new Error('IPC 调用来源不受信任')
  }
}
