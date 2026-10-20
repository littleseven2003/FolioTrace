import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createTrustedRenderer,
  isTrustedRendererUrl,
  validateIpcCaller,
  type IpcCaller,
  type TrustedRenderer
} from '../../src/main/ipc/trust'
import { ERROR_MESSAGES, type FolioError, type Result } from '../../src/shared/result'

const PRODUCTION_ENTRY_PATH = '/opt/FolioTrace/out/renderer/index.html'
const PRODUCTION_ENTRY_URL = pathToFileURL(PRODUCTION_ENTRY_PATH).href

function expectRejected(result: Result<void>): FolioError {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('预期调用被拒绝')
  return result.error
}

function createProductionRenderer(): TrustedRenderer {
  return createTrustedRenderer({
    webContentsId: 7,
    frameProcessId: 42,
    frameRoutingId: 3,
    devServerUrl: null,
    productionEntryPath: PRODUCTION_ENTRY_PATH
  })
}

function createDevelopmentRenderer(devServerUrl = 'http://localhost:5173/'): TrustedRenderer {
  return createTrustedRenderer({
    webContentsId: 7,
    frameProcessId: 42,
    frameRoutingId: 3,
    devServerUrl,
    productionEntryPath: PRODUCTION_ENTRY_PATH
  })
}

const productionCaller: IpcCaller = {
  webContentsId: 7,
  frameProcessId: 42,
  frameRoutingId: 3,
  frameUrl: PRODUCTION_ENTRY_URL
}

describe('isTrustedRendererUrl', () => {
  it('生产环境只信任应用实际加载的入口文件', () => {
    const trusted = createProductionRenderer()

    expect(isTrustedRendererUrl(PRODUCTION_ENTRY_URL, trusted)).toBe(true)
    expect(isTrustedRendererUrl(`${PRODUCTION_ENTRY_URL}#/materials`, trusted)).toBe(true)
    expect(isTrustedRendererUrl(pathToFileURL('/tmp/evil.html').href, trusted)).toBe(false)
    expect(isTrustedRendererUrl('file:///tmp/evil.html', trusted)).toBe(false)
    expect(isTrustedRendererUrl('https://example.com/', trusted)).toBe(false)
    expect(isTrustedRendererUrl('不是 URL', trusted)).toBe(false)
  })

  it('开发环境只信任配置的开发服务器来源', () => {
    const trusted = createDevelopmentRenderer()

    expect(isTrustedRendererUrl('http://localhost:5173/', trusted)).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5173/src/main.tsx', trusted)).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5174/', trusted)).toBe(false)
    expect(isTrustedRendererUrl('https://localhost:5173/', trusted)).toBe(false)
    expect(isTrustedRendererUrl(PRODUCTION_ENTRY_URL, trusted)).toBe(false)
  })
})

describe('validateIpcCaller', () => {
  it('接受可信主窗口的主框架', () => {
    expect(validateIpcCaller(productionCaller, createProductionRenderer()).ok).toBe(true)
  })

  it('开发服务器入口的主框架同样被接受', () => {
    const developmentTrusted = createDevelopmentRenderer()
    expect(
      validateIpcCaller(
        { ...productionCaller, frameUrl: 'http://localhost:5173/' },
        developmentTrusted
      ).ok
    ).toBe(true)
  })

  it('拒绝其他窗口', () => {
    const error = expectRejected(
      validateIpcCaller({ ...productionCaller, webContentsId: 8 }, createProductionRenderer())
    )
    expect(error.code).toBe('UNTRUSTED_SOURCE')
    expect(error.message).toBe(ERROR_MESSAGES.untrustedSource)
  })

  it('拒绝子框架', () => {
    const error = expectRejected(
      validateIpcCaller({ ...productionCaller, frameRoutingId: 4 }, createProductionRenderer())
    )
    expect(error.code).toBe('UNTRUSTED_SOURCE')
  })

  it('拒绝缺少主框架标识的调用', () => {
    expect(
      expectRejected(
        validateIpcCaller(
          { ...productionCaller, frameProcessId: null, frameRoutingId: null },
          createProductionRenderer()
        )
      ).code
    ).toBe('UNTRUSTED_SOURCE')
  })

  it('拒绝主框架 URL 不在实际入口的调用', () => {
    const error = expectRejected(
      validateIpcCaller(
        { ...productionCaller, frameUrl: 'https://example.com/' },
        createProductionRenderer()
      )
    )
    expect(error.code).toBe('UNTRUSTED_SOURCE')
  })

  it('主窗口不存在或已销毁时拒绝', () => {
    const error = expectRejected(validateIpcCaller(productionCaller, null))
    expect(error.code).toBe('UNTRUSTED_SOURCE')
  })
})
