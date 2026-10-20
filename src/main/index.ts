import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { APP_TITLE } from '../shared/app'
import { registerIpcHandlers } from './ipc/handlers'
import { isTrustedRendererUrl } from './ipc/trust'
import { MockProjectRepository } from './services/mock-repository'

const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']
const repository = new MockProjectRepository()

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

  window.once('ready-to-show', () => window.show())

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
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

  registerIpcHandlers(repository)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
