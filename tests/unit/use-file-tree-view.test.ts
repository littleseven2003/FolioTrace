import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFileTreeView } from '../../src/renderer/src/features/files/useFileTreeView'
import type { ProjectFileEntry } from '../../src/shared/files'

function file(relativePath: string): ProjectFileEntry {
  return {
    relativePath,
    type: 'PNG',
    category: 'image',
    sizeBytes: 1,
    modifiedAt: '2026-10-21T00:00:00.000Z',
    classification: 'unclassified'
  }
}

const FILES = [file('封面.png'), file('images/图一.png'), file('images/图二.png')]

describe('useFileTreeView', () => {
  it('刷新后保留仍存在的展开目录并丢弃消失目录', () => {
    const { result, rerender } = renderHook(
      ({ files, handle }) => useFileTreeView(files, handle),
      { initialProps: { files: FILES, handle: 'project-a' } }
    )

    act(() => result.current.toggleDirectory('images'))
    expect(result.current.expanded.has('images')).toBe(true)

    act(() =>
      rerender({ files: [...FILES, file('media/视频.mp4')], handle: 'project-a' })
    )
    expect(result.current.expanded.has('images')).toBe(true)

    act(() =>
      rerender({ files: [file('封面.png'), file('media/视频.mp4')], handle: 'project-a' })
    )
    expect(result.current.expanded.has('images')).toBe(false)
  })

  it('项目改变时重置展开、搜索与视图', () => {
    const { result, rerender } = renderHook(
      ({ files, handle }) => useFileTreeView(files, handle),
      { initialProps: { files: FILES, handle: 'project-a' } }
    )

    act(() => result.current.toggleDirectory('images'))
    act(() => result.current.setQuery('图一'))
    act(() => result.current.setView('flat'))
    expect(result.current.expanded.has('images')).toBe(true)
    expect(result.current.query).toBe('图一')
    expect(result.current.view).toBe('flat')

    act(() => rerender({ files: FILES, handle: 'project-b' }))

    expect(result.current.expanded.size).toBe(0)
    expect(result.current.query).toBe('')
    expect(result.current.view).toBe('tree')
  })
})
