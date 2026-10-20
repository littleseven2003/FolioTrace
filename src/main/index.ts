import { app, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'node:path'
import type { RuntimeInfo } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'

const APP_TITLE = '文脉 / FolioTrace'
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

/** 只允许开发服务器同源页面或打包后的本地文件。 */
function isTrustedRendererUrl(rawUrl: string): boolean {
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

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: APP_TITLE,
    backgroundColor: '#f4f7fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  window.once('ready-to-show', () => window.show())

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.runtimeInfo, (event): RuntimeInfo => {
    if (!event.senderFrame || !isTrustedRendererUrl(event.senderFrame.url)) {
      throw new Error('IPC 调用来源不受信任')
    }
    return {
      appName: APP_TITLE,
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome
    }
  })
}

function hardenWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event, url) => {
      if (!isTrustedRendererUrl(url)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}

hardenWebContents()

void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
