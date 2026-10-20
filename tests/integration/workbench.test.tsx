import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoProjectSnapshot } from '../../src/main/mocks/demo-project'
import { App } from '../../src/renderer/src/app/App'

function installFolioMock(overrides: Record<string, unknown> = {}): void {
  const folio = {
    getRuntimeInfo: vi.fn().mockResolvedValue({
      appName: '文脉 / FolioTrace',
      appVersion: '0.0.0',
      electronVersion: '44.9.0',
      chromeVersion: '152.0.0'
    }),
    getProjectSnapshot: vi.fn().mockResolvedValue(createDemoProjectSnapshot()),
    ...overrides
  }

  Object.defineProperty(window, 'folio', {
    configurable: true,
    writable: true,
    value: folio
  })
}

async function renderLoadedWorkbench(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('list', { name: '产出材料' })
  return user
}

beforeEach(() => {
  installFolioMock()
})

describe('产出材料工作台', () => {
  it('默认显示三份材料，PPT 最新版本带“最新生成”但不是“当前采用”', async () => {
    await renderLoadedWorkbench()

    const materialList = screen.getByRole('list', { name: '产出材料' })
    expect(within(materialList).getAllByRole('button')).toHaveLength(3)
    expect(within(materialList).getByRole('button', { name: /成果汇报 PPT/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(materialList).getByRole('button', { name: /配套详细报告/ })).toBeInTheDocument()
    expect(within(materialList).getByRole('button', { name: /汇报演讲稿/ })).toBeInTheDocument()

    const timeline = screen.getByRole('list', { name: '成果汇报 PPT 的版本时间线' })
    expect(within(timeline).getAllByRole('button')).toHaveLength(3)

    const latest = within(timeline).getByRole('button', { name: /成果汇报 PPT 第三版/ })
    expect(within(latest).getByText('最新生成')).toBeInTheDocument()
    expect(within(latest).queryByText('当前采用')).not.toBeInTheDocument()

    const current = within(timeline).getByRole('button', { name: /成果汇报 PPT 第二版/ })
    expect(within(current).getByText('当前采用')).toBeInTheDocument()
    expect(within(current).queryByText('最新生成')).not.toBeInTheDocument()

    const detail = screen.getByRole('complementary', { name: '第三版' })
    expect(within(detail).getByText('最新生成')).toBeInTheDocument()
    expect(within(detail).getByText(/当前采用：第二版/)).toBeInTheDocument()
    expect(within(detail).getByText('采用状态本轮只读')).toBeInTheDocument()
  })

  it('点击材料后时间线与右侧详情一起切换', async () => {
    const user = await renderLoadedWorkbench()

    await user.click(screen.getByRole('button', { name: /配套详细报告/ }))

    const timeline = screen.getByRole('list', { name: '配套详细报告 的版本时间线' })
    expect(within(timeline).getAllByRole('button')).toHaveLength(2)

    const reportThird = within(timeline).getByRole('button', { name: /配套详细报告 第三版/ })
    expect(within(reportThird).getByText('最新生成')).toBeInTheDocument()
    expect(within(reportThird).getByText('当前采用')).toBeInTheDocument()

    const detail = screen.getByRole('complementary', { name: '第三版' })
    expect(within(detail).getByText('最新生成')).toBeInTheDocument()
    expect(within(detail).getByText('当前采用')).toBeInTheDocument()
    expect(within(detail).getByText('202610191710-详细报告.docx')).toBeInTheDocument()
  })

  it('点击版本后详情切换，并区分历史版本与当前采用', async () => {
    const user = await renderLoadedWorkbench()

    const timeline = screen.getByRole('list', { name: '成果汇报 PPT 的版本时间线' })
    await user.click(within(timeline).getByRole('button', { name: /成果汇报 PPT 第一版/ }))

    const detail = screen.getByRole('complementary', { name: '第一版' })
    expect(within(detail).getByText('历史版本')).toBeInTheDocument()
    expect(within(detail).queryByText('最新生成')).not.toBeInTheDocument()
    expect(within(detail).queryByText('当前采用')).not.toBeInTheDocument()
    expect(within(detail).getByText(/当前采用：第二版/)).toBeInTheDocument()

    expect(within(timeline).getByRole('button', { name: /成果汇报 PPT 第一版/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('未实现页面显示明确的里程碑占位，并可返回产出材料', async () => {
    const user = await renderLoadedWorkbench()

    await user.click(screen.getByRole('button', { name: /全部文件/ }))
    expect(screen.getByRole('heading', { level: 1, name: '全部文件' })).toBeInTheDocument()
    expect(screen.getByText('该页面尚未接入')).toBeInTheDocument()
    expect(screen.getByText(/计划 M2/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /项目总览/ }))
    expect(screen.getByRole('heading', { level: 1, name: '项目总览' })).toBeInTheDocument()
    expect(screen.getByText(/计划 M3/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /待处理/ }))
    expect(screen.getByRole('heading', { level: 1, name: '待处理' })).toBeInTheDocument()
    expect(screen.getByText(/计划 M5/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /产出材料/ }))
    expect(
      screen.getByRole('heading', { level: 1, name: '让每次修改，有迹可循。' })
    ).toBeInTheDocument()
  })

  it('快照读取失败时显示错误，重试成功后恢复工作台', async () => {
    const getProjectSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error('模拟读取失败'))
      .mockResolvedValueOnce(createDemoProjectSnapshot())
    installFolioMock({ getProjectSnapshot })

    const user = userEvent.setup()
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('项目快照加载失败')
    expect(alert).toHaveTextContent('模拟读取失败')

    await user.click(within(alert).getByRole('button', { name: '重新加载' }))
    expect(await screen.findByRole('list', { name: '产出材料' })).toBeInTheDocument()
  })
})
