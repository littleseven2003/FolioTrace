import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectScan } from '../../src/shared/files'
import { ERROR_MESSAGES } from '../../src/shared/result'
import { ProjectRegistry } from '../../src/main/services/project-registry'
import { scanAuthorizedProject } from '../../src/main/services/project-service'

const cleanups: Array<() => Promise<void>> = []

async function createTempDirectory(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'folio-registry-')))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  return root
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.()
  }
})

describe('ProjectRegistry', () => {
  it('授权文件夹后只返回 handle 与只读摘要', async () => {
    const root = await createTempDirectory()
    const registry = new ProjectRegistry()

    const authorized = await registry.authorize(root)

    expect(authorized.ok).toBe(true)
    if (!authorized.ok) return
    expect(authorized.value.handle).toMatch(/^project-/)
    expect(authorized.value.name).toBe(basename(root))
    expect(authorized.value.readOnly).toBe(true)
    expect(authorized.value).not.toHaveProperty('rootPath')

    const resolved = registry.resolve(authorized.value.handle)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.value.rootPath).toBe(root)
  })

  it('未知 handle 被拒绝', () => {
    const registry = new ProjectRegistry()
    const result = registry.resolve('project-missing')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PROJECT_NOT_FOUND')
  })

  it('非文件夹路径被拒绝', async () => {
    const root = await createTempDirectory()
    const filePath = join(root, 'file.txt')
    await writeFile(filePath, 'content', 'utf8')
    const registry = new ProjectRegistry()

    const result = await registry.authorize(filePath)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_PROJECT_PATH')
    expect(result.error.message).toBe(ERROR_MESSAGES.invalidProjectPath)
  })
})

describe('scanAuthorizedProject', () => {
  it('凭有效 handle 调用扫描器', async () => {
    const root = await createTempDirectory()
    const registry = new ProjectRegistry()
    const authorized = await registry.authorize(root)
    if (!authorized.ok) throw new Error('授权失败')
    const scanner = vi.fn(
      async (handle: string): Promise<ProjectScan> => ({
        handle,
        scannedAt: '2026-10-20T07:00:00.000Z',
        files: [],
        warnings: []
      })
    )

    const result = await scanAuthorizedProject(authorized.value.handle, registry, scanner)

    expect(result.ok).toBe(true)
    expect(scanner).toHaveBeenCalledWith(authorized.value.handle, root)
  })

  it('未知 handle 不调用扫描器', async () => {
    const registry = new ProjectRegistry()
    const scanner = vi.fn()

    const result = await scanAuthorizedProject('project-missing', registry, scanner)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PROJECT_NOT_FOUND')
    expect(scanner).not.toHaveBeenCalled()
  })

  it('扫描失败返回固定错误，不泄漏内部信息', async () => {
    const root = await createTempDirectory()
    const registry = new ProjectRegistry()
    const authorized = await registry.authorize(root)
    if (!authorized.ok) throw new Error('授权失败')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const scanner = vi.fn(async () => {
      throw new Error('SECRET /Users/littleseven/private')
    })

    const result = await scanAuthorizedProject(authorized.value.handle, registry, scanner)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INTERNAL_ERROR')
    expect(result.error.message).toBe(ERROR_MESSAGES.scanFailed)
    expect(JSON.stringify(result)).not.toContain('SECRET')
    expect(consoleError).toHaveBeenCalled()
  })
})
