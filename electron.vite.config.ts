import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// 目录约定：main/preload 使用 src/main/index.ts、src/preload/index.ts，
// renderer 根目录为 src/renderer。构建产物输出到 out/。
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()]
  }
})
