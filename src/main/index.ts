import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { APP_TITLE } from '../shared/app'
import { registerIpcHandlers } from './ipc/handlers'
import { createTrustedRenderer, isTrustedRendererUrl, type TrustedRenderer } from './ipc/trust'
import { MockProjectRepository } from './services/mock-repository'

const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL'] ?? null
const RENDERER_ENTRY_PATH = join(__dirname, '../renderer/index.html')
const repository = new MockProjectRepository()

let mainWindow: BrowserWindow | null = null

/** 只信任当前主窗口的 main frame 及其实际入口 URL。 */
function getTrustedRenderer(): TrustedRenderer | null {
  if (!mainWindow || mainWindow.isDestroyed()) return null

  const frame = mainWindow.webContents.mainFrame
  return createTrustedRenderer({
    webContentsId: mainWindow.webContents.id,
    frameProcessId: frame.processId,
    frameRoutingId: frame.routingId,
    devServerUrl: RENDERER_DEV_URL,
    productionEntryPath: RENDERER_ENTRY_PATH
  })
}

function isTrustedNavigation(url: string): boolean {
  const trusted = getTrustedRenderer()
  return trusted !== null && isTrustedRendererUrl(url, trusted)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
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

  mainWindow = window
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  window.once('ready-to-show', () => window.show())

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadFile(RENDERER_ENTRY_PATH)
  }
}

function hardenWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))

    contents.on('will-navigate', (event) => {
      if (!isTrustedNavigation(event.url)) event.preventDefault()
    })
    contents.on('will-redirect', (event) => {
      if (!isTrustedNavigation(event.url)) event.preventDefault()
    })
    contents.on('will-frame-navigate', (event) => {
      if (!event.isMainFrame || !isTrustedNavigation(event.url)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}

hardenWebContents()

void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })

  registerIpcHandlers({ repository, getTrustedRenderer })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
