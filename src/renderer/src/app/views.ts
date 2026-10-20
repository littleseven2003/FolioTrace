export type WorkbenchView = 'materials' | 'files' | 'overview' | 'pending'

export interface PlaceholderContent {
  title: string
  description: string
  body: string
  milestone: string
}

export const PLACEHOLDER_CONTENT: Record<Exclude<WorkbenchView, 'materials'>, PlaceholderContent> =
  {
    files: {
      title: '全部文件',
      description: '按用途登记文件，不改变实际存放位置。',
      body: '真实目录扫描与文件分类将在 M2 接入。本轮只读取模拟项目快照，不会扫描或修改磁盘上的业务文件。',
      milestone: 'M2'
    },
    overview: {
      title: '项目总览',
      description: '用图谱表达版本延续与跨材料配套关系。',
      body: '完整项目版本图谱与配套关系将在 M3 实现。当前可以先在“产出材料”中查看单份材料的版本时间线。',
      milestone: 'M3'
    },
    pending: {
      title: '待处理',
      description: '集中展示需要你确认的事项。',
      body: '变更导入、文件对账与异常恢复将在 M5 实现。本轮待处理数量来自模拟快照，暂不可处理。',
      milestone: 'M5'
    }
  }
