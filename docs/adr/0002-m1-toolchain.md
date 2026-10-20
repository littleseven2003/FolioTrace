# ADR 0002：M1 桌面工具链与最小窗口

状态：接受（M1 第一步）

上下文：M0 只有文档、原型和启动包检查。M1 需要可启动的 Electron 桌面窗口、main/preload/renderer 隔离和可复现依赖；开发机为 macOS 26.6.2 arm64，Node v26.0.0、npm 11.12.1。

决策：

- Electron 44.9.0（内置 Node 24.22.0、Chromium 152）。使用 npm `latest` 稳定版，不采用 beta/alpha。
- electron-vite 6.0.0 + Vite 8.3.4 + @vitejs/plugin-react 6.1.2，统一 main/preload/renderer 构建；renderer 使用 React 19.3.1。
- TypeScript 5.9.3：M1 后续要接入 lint 与类型化 IPC，优先选择工具链兼容性明确的稳定系列；不采用 TypeScript 7 原生编译器。
- @types/node 24.19.2：对齐 Electron 44 内置 Node 24，而不是开发机 Node 26。
- 依赖在 `package.json` 写精确版本，由 `package-lock.json` 固定完整传递依赖；不自动升级、不使用 `--force` 或 `--legacy-peer-deps`。
- 窗口安全基线：`contextIsolation=true`、`nodeIntegration=false`、`sandbox=true`；preload 只暴露白名单方法；不暴露 `ipcRenderer`、fs 或 shell。
- 开发启动由 `scripts/dev.mjs` 包装 electron-vite，移除从 Electron 宿主继承的 `ELECTRON_RUN_AS_NODE`，避免把应用以 Node 模式执行。

代价与限制：

- 生产 CSP、受控应用协议、打包签名尚未实现，留到 M1 后续或发布阶段。
- DSH 文件沙箱内 Chromium 嵌套沙箱无法初始化；验证时临时使用 electron-vite 的 `--noSandbox` 与关闭 GPU 参数，应用配置本身未降低隔离要求。
- 依赖安装后的 Electron 二进制手工验证依赖临时 HOME 缓存；普通终端不需要该变通。

参考（2026-10-20 查阅）：

- Electron 44.9.0 与内置 Node/Chromium 版本：https://releases.electronjs.org/
- electron-vite 6 文档与 CLI：https://electron-vite.org/
- Vite 8 文档：https://vite.dev/guide/
