import { createHash } from 'node:crypto'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  scanProjectDirectory,
  type ScanFileSystem
} from '../../src/main/services/file-scanner'

const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'folio-scan-')))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root) await rm(root, { recursive: true, force: true })
  }
})

async function writeFileAt(root: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = join(root, relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
}

/** 记录文件内容哈希，用于证明扫描没有改写业务文件。 */
async function snapshotTree(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  async function walk(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath)
      } else if (entry.isFile()) {
        const content = await readFile(absolutePath)
        result.set(relativePath, createHash('sha256').update(content).digest('hex'))
      }
    }
  }

  await walk(root, '')
  return result
}

describe('scanProjectDirectory', () => {
  it('只读扫描文件元数据，忽略内部目录与所有符号链接', async () => {
    const root = await createTempRoot()
    const outside = await createTempRoot()
    await writeFileAt(root, 'report.docx', 'hello')
    await writeFileAt(root, 'notes.md', '# notes')
    await writeFileAt(root, 'assets/chart.png', 'png')
    await writeFileAt(root, '.git/config', 'secret')
    await writeFileAt(root, '.docwork/project.json', '{}')
    await writeFileAt(root, 'node_modules/pkg/index.js', 'module')
    await writeFileAt(outside, 'outside-secret.txt', 'outside')
    await symlink(join(outside, 'outside-secret.txt'), join(root, 'outside-link.txt'))
    await symlink(outside, join(root, 'outside-directory'))
    await symlink(join(root, 'assets'), join(root, 'assets-link'))
    await mkdir(join(root, 'empty-directory'))

    const before = await snapshotTree(root)
    const result = await scanProjectDirectory('handle-1', root, {
      now: () => new Date('2026-10-20T07:00:00.000Z')
    })
    const after = await snapshotTree(root)

    expect(result.scannedAt).toBe('2026-10-20T07:00:00.000Z')
    expect(result.warnings).toEqual([])
    expect(result.files.map((file) => file.relativePath)).toEqual([
      'assets/chart.png',
      'notes.md',
      'report.docx'
    ])
    expect(result.files.find((file) => file.relativePath === 'report.docx')).toMatchObject({
      type: 'DOCX',
      category: 'document',
      sizeBytes: 5,
      classification: 'unclassified'
    })
    expect(result.files.find((file) => file.relativePath === 'notes.md')).toMatchObject({
      type: 'MD',
      category: 'text'
    })
    expect(after).toEqual(before)
    expect([...after.keys()]).not.toContain('outside-link.txt')
    expect([...after.keys()]).not.toContain('outside-directory/outside-secret.txt')
    expect([...after.keys()]).not.toContain('project.json')
    expect([...after.keys()]).not.toContain('AGENTS.md')
  })

  it('权限不足的目录只产生警告，不中断扫描', async () => {
    if (process.platform === 'win32') return

    const root = await createTempRoot()
    await writeFileAt(root, 'visible.txt', 'visible')
    const restricted = join(root, 'restricted')
    await mkdir(restricted)
    await writeFileAt(root, 'restricted/hidden.txt', 'hidden')
    await chmod(restricted, 0o000)

    try {
      const result = await scanProjectDirectory('handle-2', root)

      expect(result.files.map((file) => file.relativePath)).toEqual(['visible.txt'])
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'PERMISSION_DENIED', relativePath: 'restricted' })
      )
    } finally {
      await chmod(restricted, 0o755)
    }
  })

  it('扫描期间文件消失时跳过并记录警告', async () => {
    const root = '/virtual-project'
    const fakeFs: ScanFileSystem = {
      realpath: async (path) => path,
      readdir: async (path) =>
        path === root
          ? [
              {
                name: 'gone.txt',
                isDirectory: () => false,
                isFile: () => true,
                isSymbolicLink: () => false
              }
            ]
          : [],
      lstat: async () => {
        const error = new Error('gone') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        throw error
      }
    }

    const result = await scanProjectDirectory('handle-3', root, {
      fs: fakeFs,
      now: () => new Date('2026-10-20T07:00:00.000Z')
    })

    expect(result.files).toEqual([])
    expect(result.warnings).toEqual([
      {
        code: 'ENTRY_DISAPPEARED',
        relativePath: 'gone.txt',
        message: '扫描期间文件已不存在，已跳过。'
      }
    ])
  })
})
