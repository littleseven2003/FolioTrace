import type { ProjectSnapshot } from '../../shared/project'

/**
 * 本轮使用固定的模拟项目；数据独立于 React 组件，后续由真实 project.json 服务替换。
 * revision 只是模拟快照版本号，不代表真实业务项目已写入磁盘。
 */
export function createDemoProjectSnapshot(): ProjectSnapshot {
  return {
    projectId: 'demo-annual-report',
    projectName: '年度成果汇报',
    description: '资料、版本与每一次修改',
    revision: 7,
    fileCount: 10,
    pendingCount: 2,
    updatedAt: '2026-10-20T09:30:00+08:00',
    materials: [
      {
        id: 'ppt',
        name: '成果汇报 PPT',
        type: 'PPT',
        currentVersionId: 'ppt-v2',
        versions: [
          {
            id: 'ppt-v3',
            label: '第三版',
            generatedAt: '2026-10-20T09:30:00+08:00',
            fileName: '202610200930-成果汇报.pptx',
            summary: [
              '补充第四季度预算与执行数据',
              '调整实施进度，将关键节点提前至 11 月',
              '报告与演讲稿未同步修改'
            ],
            baseVersionLabel: '第二版',
            author: 'Codex',
            status: 'pending'
          },
          {
            id: 'ppt-v2',
            label: '第二版',
            generatedAt: '2026-10-19T14:30:00+08:00',
            fileName: '202610191430-成果汇报.pptx',
            summary: ['按评审意见重组章节结构', '合并重复案例，精简背景介绍'],
            baseVersionLabel: '第一版',
            author: 'DSH',
            status: 'confirmed'
          },
          {
            id: 'ppt-v1',
            label: '第一版',
            generatedAt: '2026-10-17T16:00:00+08:00',
            fileName: '202610171600-成果汇报.pptx',
            summary: ['结合项目资料形成初稿'],
            baseVersionLabel: '无 · 初稿',
            author: 'Codex',
            status: 'confirmed'
          }
        ]
      },
      {
        id: 'report',
        name: '配套详细报告',
        type: 'DOC',
        currentVersionId: 'report-v3',
        versions: [
          {
            id: 'report-v3',
            label: '第三版',
            generatedAt: '2026-10-19T17:10:00+08:00',
            fileName: '202610191710-详细报告.docx',
            summary: ['依据 PPT 第二版调整报告结构', '补充各项指标的详细说明'],
            baseVersionLabel: '第二版',
            author: 'Codex',
            status: 'confirmed'
          },
          {
            id: 'report-v2',
            label: '第二版',
            generatedAt: '2026-10-18T10:20:00+08:00',
            fileName: '202610181020-详细报告.docx',
            summary: ['补充项目案例与数据说明'],
            baseVersionLabel: '第一版（未导入）',
            author: 'Codex',
            status: 'confirmed'
          }
        ]
      },
      {
        id: 'speech',
        name: '汇报演讲稿',
        type: 'MD',
        currentVersionId: 'speech-v2',
        versions: [
          {
            id: 'speech-v2',
            label: '第二版',
            generatedAt: '2026-10-19T18:00:00+08:00',
            fileName: '202610191800-演讲稿.md',
            summary: ['按 PPT 第二版逐页调整讲述顺序', '将预计讲述时间控制在 15 分钟'],
            baseVersionLabel: '第一版（未导入）',
            author: 'DSH',
            status: 'confirmed'
          }
        ]
      }
    ]
  }
}
