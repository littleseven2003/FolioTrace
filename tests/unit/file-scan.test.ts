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
  type ScanDirent,
  type ScanFileSystem,
  type ScanStats
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

function directoryStats(identity: { dev: number; ino: number }): ScanStats {
  return {
    size: 0,
    mtimeMs: 0,
    dev: identity.dev,
    ino: identity.ino,
    isFile: () => false,
    isDirectory: () => true,
    isSymbolicLink: () => false
  }
}

function fileStats(identity: { dev: number; ino: number }): ScanStats {
  return {
    size: 5,
    mtimeMs: Date.parse('2026-10-20T06:00:00.000Z'),
    dev: identity.dev,
    ino: identity.ino,
    isFile: () => true,
    isDirectory: () => false,
    isSymbolicLink: () => false
  }
}

function dirent(name: string, kind: 'file' | 'directory'): ScanDirent {
  return {
    name,
    isDirectory: () => kind === 'directory',
    isFile: () => kind === 'file',
    isSymbolicLink: () => false
  }
}

function missingError(): NodeJS.ErrnoException {
  const error = new Error('gone') as NodeJS.ErrnoException
  error.code = 'ENOENT'
  return error
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
      readdir: async (path) => (path === root ? [dirent('gone.txt', 'file')] : []),
      lstat: async (path) => {
        if (path === root) return directoryStats({ dev: 1, ino: 1 })
        throw missingError()
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

  it('子目录在 readdir 后被替换时终止扫描，不返回任何文件', async () => {
    const root = '/root'
    const state = { replaced: false }
    const fakeFs: ScanFileSystem = {
      realpath: async (path) => {
        if (path === root) return root
        if (path === '/root/sub') return state.replaced ? '/outside/evil' : '/root/sub'
        return path
      },
      readdir: async (path) => {
        if (path === root) return [dirent('sub', 'directory')]
        if (path === '/root/sub') {
          state.replaced = true
          return [dirent('outside.txt', 'file')]
        }
        return []
      },
      lstat: async (path) => {
        if (path === root) return directoryStats({ dev: 1, ino: 1 })
        if (path === '/root/sub') {
          return directoryStats(state.replaced ? { dev: 9, ino: 9 } : { dev: 1, ino: 2 })
        }
        return fileStats({ dev: 9, ino: 10 })
      }
    }

    const result = await scanProjectDirectory('handle-4', root, { fs: fakeFs })

    expect(result.files).toEqual([])
    expect(result.warnings).toEqual([
      {
        code: 'SCAN_ABORTED',
        relativePath: 'sub',
        message: '扫描期间目录发生变化，已终止本次扫描，未采用任何文件结果。'
      }
    ])
  })

  it('祖先目录被替换、子目录解析到根外时终止扫描', async () => {
    const root = '/root'
    const fakeFs: ScanFileSystem = {
      realpath: async (path) => {
        if (path === root) return root
        if (path === '/root/a') return '/root/a'
        if (path === '/root/a/b') return '/outside/b'
        return path
      },
      readdir: async (path) => {
        if (path === root) return [dirent('a', 'directory')]
        if (path === '/root/a') return [dirent('b', 'directory')]
        return []
      },
      lstat: async (path) => {
        if (path === root) return directoryStats({ dev: 1, ino: 1 })
        if (path === '/root/a') return directoryStats({ dev: 1, ino: 2 })
        return directoryStats({ dev: 9, ino: 3 })
      }
    }

    const result = await scanProjectDirectory('handle-5', root, { fs: fakeFs })

    expect(result.files).toEqual([])
    expect(result.warnings[0]).toMatchObject({
      code: 'SCAN_ABORTED',
      relativePath: 'a/b'
    })
  })

  it('根目录在扫描期间被替换时终止扫描', async () => {
    const root = '/root'
    let rootLstatCalls = 0
    const fakeFs: ScanFileSystem = {
      realpath: async (path) => path,
      readdir: async (path) => (path === root ? [dirent('file.txt', 'file')] : []),
      lstat: async (path) => {
        if (path === root) {
          rootLstatCalls += 1
          return directoryStats(rootLstatCalls === 1 ? { dev: 1, ino: 1 } : { dev: 2, ino: 2 })
        }
        return fileStats({ dev: 1, ino: 5 })
      }
    }

    const result = await scanProjectDirectory('handle-6', root, {
      fs: fakeFs,
      expectedRootIdentity: { dev: 1, ino: 1 }
    })

    expect(result.files).toEqual([])
    expect(result.warnings[0]).toMatchObject({ code: 'SCAN_ABORTED', relativePath: '.' })
  })

  it('文件元数据读取后父目录身份变化时终止扫描', async () => {
    const root = '/root'
    let rootLstatCalls = 0
    const fakeFs: ScanFileSystem = {
      realpath: async (path) => path,
      readdir: async (path) => (path === root ? [dirent('file.txt', 'file')] : []),
      lstat: async (path) => {
        if (path === root) {
          rootLstatCalls += 1
          return directoryStats(rootLstatCalls <= 3 ? { dev: 1, ino: 1 } : { dev: 2, ino: 2 })
        }
        return fileStats({ dev: 1, ino: 5 })
      }
    }

    const result = await scanProjectDirectory('handle-7', root, {
      fs: fakeFs,
      expectedRootIdentity: { dev: 1, ino: 1 }
    })

    expect(result.files).toEqual([])
    expect(result.warnings[0]).toMatchObject({ code: 'SCAN_ABORTED' })
  })
})
