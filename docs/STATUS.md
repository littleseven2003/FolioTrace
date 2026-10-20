# 开发状态

更新时间：2026-10-20

## 已完成 M0

产品与架构、交互原型、数据 schema 与合成 fixture、DSH 提示词、贡献与 Git 规范、启动包检查。原型品牌已更新为文脉 / FolioTrace。

## M1 进行中：第一步（开发环境与最小桌面窗口）

已完成：

- 建立 Electron + React + TypeScript + Vite 工程：main / preload / renderer / shared 目录、`electron.vite.config.ts`、Node 与 Web 分离的 tsconfig、按精确版本锁定依赖并提交 `package-lock.json`。
- 最小窗口：1000×700，标题“文脉 / FolioTrace”，显示“开发环境已就绪”、品牌标识和运行时版本。
- 安全边界：`contextIsolation=true`、`nodeIntegration=false`、`sandbox=true`、`webSecurity=true`；preload 仅通过 contextBridge 暴露 `window.folio.getRuntimeInfo()`；主进程校验 IPC 来源，拒绝新窗口、非受信导航、webview 附加与所有权限请求。
- 开发启动脚本 `scripts/dev.mjs`：启动前移除从 Electron 宿主继承的 `ELECTRON_RUN_AS_NODE`，确保 `npm run dev` 真正打开窗口。

### 实际运行结果

| 命令 | 结果 |
| --- | --- |
| `npm install` | 成功；Electron 44.9.0 二进制在 DSH 沙箱内经临时 HOME 下载，普通终端无需该变通 |
| `npm run check` | 通过（69 个文件；启动包检查与提交标题自测） |
| `npm run typecheck` | 通过（main/preload 与 renderer 两套 tsconfig） |
| `npm run build` | 通过（`out/main`、`out/preload`、`out/renderer` 生成） |
| `npm run dev` | 成功启动桌面窗口；经 CDP 读取页面确认标题、品牌、“开发环境已就绪”、运行时信息，且渲染进程无 `require` / `process` / `ipcRenderer` |
| `npm start -- --skipBuild` | 生产构建预览窗口同样通过上述 CDP 校验 |

本轮验证环境：macOS 26.6.2（arm64）、Node v26.0.0、npm 11.12.1、Electron 44.9.0（Node 24.22.0 / Chromium 152）、electron-vite 6.0.0、Vite 8.3.4、React 19.3.1、TypeScript 5.9.3。版本选择理由见 [ADR 0002](adr/0002-m1-toolchain.md)。

### 启动命令

普通终端（不在 DSH 文件沙箱内）：

```sh
npm install
npm run dev
```

DSH 会话内 Chromium 嵌套沙箱无法初始化（`sandbox initialization failed: Operation not permitted`），验证时使用 electron-vite 的临时参数，未改变应用本身的 `sandbox: true` 配置：

```sh
npm run dev -- --noSandbox -- --disable-gpu
```

这是 DSH 沙箱限制，不是应用默认配置；普通终端不应携带这些参数。

### 手工确认步骤

1. 在普通终端执行 `npm install && npm run dev`，等待约 5 秒。
2. 出现 1000×700 窗口，标题栏为“文脉 / FolioTrace”。
3. 内容卡片依次显示“文脉 / FolioTrace”“开发环境已就绪”和 `Electron 44.9.0 · Chromium …` 运行时行。
4. 按 `Cmd+Q` 退出（或终端 `Ctrl+C` 结束开发服务器）。

## 下一步（M1 剩余）

建立完整类型化 `window.folio` 契约与 MockRepository，按原型完成导航、材料卡、版本时间线的最小纵向切片；加入 lint、unit test，并扩展 `check` 与 CI（`npm ci`、typecheck、test、build）。

## 已知限制

- 尚未实现文件扫描、版本图谱、任务管理、Agent 接入、真实目录选择与 `project.json` 写入。
- 尚无生产 CSP、受控应用协议、打包/签名/安装包；`src/domain`、`src/adapters` 尚未创建。
- 启动包检查不等同于完整 JSON Schema 或应用测试；M1 仍需加入 Ajv 等正式 schema 校验。
- DSH 会话内需 `--noSandbox` 才能启动 Electron，普通终端是否无参数启动仍需人工验收。

## 每阶段更新

记录阶段、分支、提交、运行命令与结果、未完成项、下轮入口。Git 实际接入信息见 REPOSITORY.md。

## 提交与版本规则更新

已要求每个完成并验证的小改动立即独立 commit，格式为英文类型＋中文全角冒号＋中文描述；新增 docs/09-versioning.md。当前 package 0.0.0、schemaVersion 1 保持不变，尚未发布任何桌面版本。

提交格式现有本地 hook 与 CI 检查；克隆后按启动指南启用 hook。版本规范没有触发应用发布。
