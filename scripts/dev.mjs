#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env }

// 从 Electron 宿主（例如 DSH）继承的该变量会让 electron 以 Node 模式运行，
// 只执行脚本而不打开窗口；开发启动时显式移除。
delete env.ELECTRON_RUN_AS_NODE

const command = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
)

const child = spawn(command, ['dev', ...process.argv.slice(2)], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', (code) => process.exit(code ?? 0))
