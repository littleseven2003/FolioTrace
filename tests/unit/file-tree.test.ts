import { describe, expect, it } from 'vitest'
import {
  buildFileTree,
  filterFilesByPath,
  visibleFileTreeRows
} from '../../src/domain/file-tree'
import type { FileCategory, ProjectFileEntry } from '../../src/shared/files'

function file(relativePath: string, category: FileCategory = 'other'): ProjectFileEntry {
  const dot = relativePath.lastIndexOf('.')
  return {
    relativePath,
    type: dot > 0 ? relativePath.slice(dot + 1).toUpperCase() : '无扩展名',
    category,
    sizeBytes: 1,
    modifiedAt: '2026-10-21T00:00:00.000Z',
    classification: 'unclassified'
  }
}

const FILES: ProjectFileEntry[] = [
  file('README.md', 'text'),
  file('images/封面.png', 'image'),
  file('images/figures/架构.svg', 'image'),
  file('media/演示视频.mp4'),
  file('media/背景音乐.mp3'),
  file('报告/初稿.docx', 'document'),
  file('a/汇报.docx', 'document'),
  file('b/汇报.docx', 'document'),
  file('参考资料/2026 年度总结/很长的中文文件名用于检查路径换行与搜索.docx', 'document')
]

const EMPTY: ReadonlySet<string> = new Set()

describe('buildFileTree', () => {
  it('仅由扫描路径构建目录树，根下文件直接可见并统计后代数量', () => {
    const tree = buildFileTree(FILES)

    expect(tree.totalFiles).toBe(9)
    expect(tree.directoryPaths).toEqual([
      'a',
      'b',
      'images',
      'images/figures',
      'media',
      '参考资料',
      '参考资料/2026 年度总结',
      '报告'
    ])

    const names = tree.entries.map((entry) => entry.name)
    // 目录排在文件前；根下 README.md 与各目录同级。
    expect(names).toEqual(['a', 'b', 'images', 'media', '参考资料', '报告', 'README.md'])

    const images = tree.entries.find((entry) => entry.path === 'images')
    expect(images).toMatchObject({ kind: 'directory', fileCount: 2 })
    const media = tree.entries.find((entry) => entry.path === 'media')
    expect(media).toMatchObject({ kind: 'directory', fileCount: 2 })
    const report = tree.entries.find((entry) => entry.path === '报告')
    expect(report).toMatchObject({ kind: 'directory', fileCount: 1 })
  })

  it('同名文件保留在不同祖先目录下，空文件列表不产生目录', () => {
    const tree = buildFileTree(FILES)
    const a = tree.entries.find((entry) => entry.path === 'a')
    const b = tree.entries.find((entry) => entry.path === 'b')
    expect(a).toMatchObject({ kind: 'directory', fileCount: 1 })
    expect(b).toMatchObject({ kind: 'directory', fileCount: 1 })

    const empty = buildFileTree([])
    expect(empty.entries).toEqual([])
    expect(empty.totalFiles).toBe(0)
    expect(empty.directoryPaths).toEqual([])
  })
})

describe('visibleFileTreeRows', () => {
  it('默认目录视图折叠子目录，根下文件直接显示', () => {
    const tree = buildFileTree(FILES)
    const visible = visibleFileTreeRows(tree, EMPTY, '')

    expect(visible.searching).toBe(false)
    expect(visible.matchedFiles).toBe(9)
    expect(visible.rows.map((row) => row.path)).toEqual([
      'a',
      'b',
      'images',
      'media',
      '参考资料',
      '报告',
      'README.md'
    ])
    expect(visible.rows.every((row) => row.kind === 'directory' || row.path === 'README.md')).toBe(
      true
    )
  })

  it('展开目录只显示下一层，嵌套目录仍折叠', () => {
    const tree = buildFileTree(FILES)
    const visible = visibleFileTreeRows(tree, new Set(['images']), '')

    expect(visible.rows.map((row) => row.path)).toEqual([
      'a',
      'b',
      'images',
      'images/figures',
      'images/封面.png',
      'media',
      '参考资料',
      '报告',
      'README.md'
    ])
    expect(visible.rows.some((row) => row.path === 'images/figures/架构.svg')).toBe(false)

    const nested = visibleFileTreeRows(tree, new Set(['images', 'images/figures']), '')
    expect(nested.rows.map((row) => row.path)).toContain('images/figures/架构.svg')
  })

  it('搜索完整相对路径时显示命中文件和祖先，不显示同级未命中文件', () => {
    const tree = buildFileTree(FILES)
    const visible = visibleFileTreeRows(tree, new Set(['media']), 'figures/架构')

    expect(visible.searching).toBe(true)
    expect(visible.matchedFiles).toBe(1)
    expect(visible.rows.map((row) => row.path)).toEqual([
      'images',
      'images/figures',
      'images/figures/架构.svg'
    ])
    expect(visible.rows.some((row) => row.path === 'images/封面.png')).toBe(false)
  })

  it('搜索同名文件时各自显示祖先路径', () => {
    const tree = buildFileTree(FILES)
    const visible = visibleFileTreeRows(tree, EMPTY, '汇报.docx')

    expect(visible.matchedFiles).toBe(2)
    expect(visible.rows.map((row) => row.path)).toEqual(['a', 'a/汇报.docx', 'b', 'b/汇报.docx'])
  })

  it('搜索忽略并保留原展开状态，无匹配时返回空行', () => {
    const expanded = new Set(['media'])
    const tree = buildFileTree(FILES)

    const searched = visibleFileTreeRows(tree, expanded, '封面')
    expect(searched.rows.map((row) => row.path)).toEqual(['images', 'images/封面.png'])

    const afterClear = visibleFileTreeRows(tree, expanded, '')
    expect(afterClear.rows.some((row) => row.path === 'media/演示视频.mp4')).toBe(true)
    expect(expanded).toEqual(new Set(['media']))

    const noMatch = visibleFileTreeRows(tree, expanded, '不存在的路径')
    expect(noMatch.matchedFiles).toBe(0)
    expect(noMatch.rows).toEqual([])
  })

  it('搜索大小写与中文长路径都可命中', () => {
    const tree = buildFileTree(FILES)
    const upper = visibleFileTreeRows(tree, EMPTY, 'README.MD')
    expect(upper.matchedFiles).toBe(1)

    const chinese = visibleFileTreeRows(tree, EMPTY, '2026 年度总结')
    expect(chinese.matchedFiles).toBe(1)
    expect(chinese.rows.map((row) => row.path)).toEqual([
      '参考资料',
      '参考资料/2026 年度总结',
      '参考资料/2026 年度总结/很长的中文文件名用于检查路径换行与搜索.docx'
    ])
  })
})

describe('filterFilesByPath', () => {
  it('平铺视图按完整路径过滤且保持原顺序', () => {
    expect(filterFilesByPath(FILES, '汇报.docx').map((item) => item.relativePath)).toEqual([
      'a/汇报.docx',
      'b/汇报.docx'
    ])
    expect(filterFilesByPath(FILES, '')).toHaveLength(9)
    expect(filterFilesByPath(FILES, '不存在')).toEqual([])
  })
})
