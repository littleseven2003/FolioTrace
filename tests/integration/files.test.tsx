import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoProjectSnapshot } from '../../src/main/mocks/demo-project'
import { App } from '../../src/renderer/src/app/App'
import type {
  ProjectFileEntry,
  ProjectScan,
  ProjectSummary,
  ScanWarning
} from '../../src/shared/files'
import { ERROR_MESSAGES, fail, ok } from '../../src/shared/result'

const PROJECT: ProjectSummary = {
  handle: 'project-test',
  name: '合成项目',
  openedAt: '2026-10-20T07:00:00.000Z',
  readOnly: true
}

const SUMMARY = {
  projectId: 'project-test',
  name: '合成项目',
  revision: 1,
  schemaVersion: 1 as const,
  fileCount: 0,
  documentCount: 0,
  versionCount: 0,
  relationCount: 0
}

const FILE_A: ProjectFileEntry = {
  relativePath: '报告/初稿.docx',
  type: 'DOCX',
  category: 'document',
  sizeBytes: 5,
  modifiedAt: '2026-10-20T06:00:00.000Z',
  classification: 'unclassified'
}

const FILE_B: ProjectFileEntry = {
  relativePath: 'notes.md',
  type: 'MD',
  category: 'text',
  sizeBytes: 2048,
  modifiedAt: '2026-10-20T05:00:00.000Z',
  classification: 'unclassified'
}

const WARNING: ScanWarning = {
  code: 'PERMISSION_DENIED',
  relativePath: 'restricted',
  message: '没有读取权限，已跳过。'
}

function makeScan(files: ProjectFileEntry[], warnings: ScanWarning[] = []): ProjectScan {
  return {
    handle: PROJECT.handle,
    scannedAt: '2026-10-20T07:00:00.000Z',
    files,
    warnings
  }
}

function installFolioMock(overrides: Record<string, unknown> = {}): void {
  const folio = {
    getRuntimeInfo: vi.fn().mockResolvedValue(
      ok({
        appName: '文脉 / FolioTrace',
        appVersion: '0.0.0',
        electronVersion: '44.9.0',
        chromeVersion: '152.0.0'
      })
    ),
    getProjectSnapshot: vi.fn().mockResolvedValue(ok(createDemoProjectSnapshot())),
    chooseProject: vi.fn().mockResolvedValue(ok({ canceled: true })),
    scanProject: vi.fn().mockResolvedValue(ok(makeScan([]))),
    getProjectMetadata: vi.fn().mockResolvedValue(ok({ status: 'none' })),
    initializeProject: vi.fn().mockResolvedValue(ok({ status: 'created', summary: SUMMARY })),
    ...overrides
  }

  Object.defineProperty(window, 'folio', {
    configurable: true,
    writable: true,
    value: folio
  })
}

async function openFilesPage(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('list', { name: '产出材料' })
  await user.click(screen.getByRole('button', { name: /全部文件/ }))
  return user
}

beforeEach(() => {
  installFolioMock()
})

describe('全部文件与目录选择', () => {
  it('取消目录选择是正常结果，不触发扫描', async () => {
    const chooseProject = vi.fn().mockResolvedValue(ok({ canceled: true }))
    const scanProject = vi.fn()
    installFolioMock({ chooseProject, scanProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    expect(chooseProject).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent('已取消选择文件夹。')
    expect(scanProject).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '打开文件夹' })).toBeInTheDocument()
  })

  it('选择真实目录后展示相对路径、元数据、未分类与扫描警告', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const scanProject = vi.fn().mockResolvedValue(ok(makeScan([FILE_A, FILE_B], [WARNING])))
    installFolioMock({ chooseProject, scanProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    expect(await screen.findByText('报告/初稿.docx')).toBeInTheDocument()
    expect(scanProject).toHaveBeenCalledWith('project-test')
    expect(screen.getByText('DOCX')).toBeInTheDocument()
    expect(screen.getByText('5 B')).toBeInTheDocument()
    expect(screen.getAllByText('未分类')).toHaveLength(2)
    expect(screen.getByText(/没有读取权限/)).toBeInTheDocument()
    expect(screen.getByText('扫描不写入业务文件')).toBeInTheDocument()
    expect(document.querySelector('.demo-badge')).toHaveTextContent('本地目录 · 只读')

    await user.click(screen.getByRole('button', { name: /产出材料/ }))
    expect(screen.getByRole('heading', { level: 1, name: '产出材料' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /M3 接入/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: '成果汇报 PPT 的版本时间线' })
    ).not.toBeInTheDocument()
  })

  it('手动重新扫描刷新文件清单', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const scanProject = vi
      .fn()
      .mockResolvedValueOnce(ok(makeScan([FILE_A])))
      .mockResolvedValueOnce(ok(makeScan([FILE_A, FILE_B])))
    installFolioMock({ chooseProject, scanProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))
    await screen.findByText('报告/初稿.docx')

    await user.click(screen.getByRole('button', { name: '重新扫描' }))

    expect(await screen.findByText('notes.md')).toBeInTheDocument()
    expect(scanProject).toHaveBeenCalledTimes(2)
  })

  it('扫描失败显示错误并可重试', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const scanProject = vi
      .fn()
      .mockResolvedValueOnce(fail('INTERNAL_ERROR', ERROR_MESSAGES.scanFailed))
      .mockResolvedValueOnce(ok(makeScan([FILE_A])))
    installFolioMock({ chooseProject, scanProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.scanFailed)

    await user.click(within(alert).getByRole('button', { name: '重试扫描' }))
    expect(await screen.findByText('报告/初稿.docx')).toBeInTheDocument()
    expect(scanProject).toHaveBeenCalledTimes(2)
  })

  it('目录授权失败显示可读错误', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(fail('PERMISSION_DENIED', ERROR_MESSAGES.permissionDenied))
    installFolioMock({ chooseProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.permissionDenied)
    expect(alert).not.toHaveTextContent('Error')
  })

  it('打开文件夹默认只读，显示未初始化且不自动创建元数据', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const scanProject = vi.fn().mockResolvedValue(ok(makeScan([FILE_A])))
    const getProjectMetadata = vi.fn().mockResolvedValue(ok({ status: 'none' }))
    const initializeProject = vi.fn()
    installFolioMock({ chooseProject, scanProject, getProjectMetadata, initializeProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    expect(
      await screen.findByRole('button', { name: '初始化文脉项目' })
    ).toBeInTheDocument()
    expect(screen.getByText(/尚未初始化文脉项目/)).toBeInTheDocument()
    expect(getProjectMetadata).toHaveBeenCalledWith('project-test')
    expect(initializeProject).not.toHaveBeenCalled()
  })

  it('用户点击初始化后显示 revision 1 与成功提示', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const getProjectMetadata = vi.fn().mockResolvedValue(ok({ status: 'none' }))
    const initializeProject = vi
      .fn()
      .mockResolvedValue(ok({ status: 'created', summary: SUMMARY }))
    installFolioMock({ chooseProject, getProjectMetadata, initializeProject })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))
    await user.click(await screen.findByRole('button', { name: '初始化文脉项目' }))

    expect(initializeProject).toHaveBeenCalledWith('project-test')
    expect(await screen.findByText(/文脉项目已初始化（revision 1）/)).toBeInTheDocument()
    expect(screen.getByText(/revision 1 · 文件记录 0 · 材料 0/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '初始化文脉项目' })
    ).not.toBeInTheDocument()
  })

  it('重新打开已有项目时读取元数据并保留 revision', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const getProjectMetadata = vi
      .fn()
      .mockResolvedValue(ok({ status: 'loaded', summary: { ...SUMMARY, revision: 4, fileCount: 2 } }))
    installFolioMock({ chooseProject, getProjectMetadata })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    expect(await screen.findByText(/revision 4 · 文件记录 2/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '初始化文脉项目' })
    ).not.toBeInTheDocument()
  })

  it('元数据损坏时显示提示且不提供覆盖初始化', async () => {
    const chooseProject = vi
      .fn()
      .mockResolvedValue(ok({ canceled: false, project: PROJECT }))
    const getProjectMetadata = vi
      .fn()
      .mockResolvedValue(fail('PROJECT_METADATA_INVALID', ERROR_MESSAGES.metadataInvalid))
    installFolioMock({ chooseProject, getProjectMetadata })

    const user = await openFilesPage()
    await user.click(screen.getByRole('button', { name: '打开文件夹' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ERROR_MESSAGES.metadataInvalid)
    expect(
      screen.queryByRole('button', { name: '初始化文脉项目' })
    ).not.toBeInTheDocument()
    expect(
      within(alert).getByRole('button', { name: '重新读取元数据' })
    ).toBeInTheDocument()
  })
})
