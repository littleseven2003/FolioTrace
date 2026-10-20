# 开发状态

更新时间：2026-10-20

## 已完成 M0

产品与架构、交互原型、数据 schema 与合成 fixture、DSH 提示词、贡献与 Git 规范、启动包检查。原型品牌已更新为文脉 / FolioTrace。

## M1 进行中：第二步（模拟数据工作台）

已完成：

- 领域层 `src/domain/project.ts`：材料、版本、项目快照类型，以及按生成时间排序、最新版本、当前采用等纯函数选择器；不依赖 React、Electron 或文件系统。
- 独立模拟数据 `src/main/mocks/demo-project.ts` 与只读 `MockProjectRepository`；每次调用返回独立快照，调用方修改不会污染后续读取。
- 类型化 preload 新增 `window.folio.getProjectSnapshot()`；主进程校验 IPC sender 后返回项目快照，renderer 仍无法访问 Node、fs 或 shell。
- 工作台界面：左侧导航（产出材料 / 全部文件 / 项目总览 / 待处理）；产出材料页含三张材料卡、中间版本时间线、右侧版本详情。点击材料或版本，时间线与详情联动切换。
- 徽标语义：分别显示“最新生成”“当前采用”“待确认”“历史版本”。PPT 最新第三版明确不是当前采用（第二版）；详情提示“最新生成版本不会自动成为当前采用版本”。本轮采用状态只读，不提供切换按钮。
- 全部文件、项目总览、待处理显示明确的里程碑占位（M2 / M3 / M5）；加载、错误重试、空状态齐全；窄窗口改为上下布局。
- 质量门：ESLint 10 + typescript-eslint 8 + React Hooks 规则；Vitest 5 + jsdom 30 + Testing Library 16；12 个单元/交互测试。`npm run check` 汇总启动包检查、typecheck、lint、test、build 与提交标题自测；GitHub Actions 改用 `npm ci`。

### 实际运行结果

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：119 个文件启动包检查、typecheck、lint、28 个测试、生产构建、提交标题自测 |
| `npm run test` | 通过：6 个测试文件 / 28 个测试（领域 7 + IPC 15 + 工作台交互 6） |
| `npm run lint` | 通过（0 warning） |
| `npm run typecheck` | 通过（main/preload、renderer、tests 三套 tsconfig） |
| `npm run build` | 通过（`out/main`、`out/preload`、`out/renderer` 生成） |
| `npm run dev` | 1280×820 工作台窗口启动；CDP 确认材料切换、版本选择、占位页、只读采用提示，renderer 无 `require` / `process` / `ipcRenderer` |
| `npm start -- --skipBuild` | 生产构建预览窗口通过同一套 CDP 交互验收 |

本轮验证环境：macOS 26.6.2（arm64）、Node v26.0.0、npm 11.12.1、Electron 44.9.0（Node 24.22.0 / Chromium 152）、electron-vite 6.0.0、Vite 8.3.4、React 19.3.1、TypeScript 5.9.3、Vitest 5.0.5。工具链决策见 [ADR 0002](adr/0002-m1-toolchain.md)。

### 手工验收步骤

普通终端（不在 DSH 文件沙箱内）执行：

```sh
npm install
npm run dev
```

1. 窗口进入“产出材料”，默认选中“成果汇报 PPT”的第三版。
2. 时间线中第三版显示“最新生成 / 待确认”，第二版显示“当前采用”；右侧提示“当前采用：第二版”。
3. 点击“配套详细报告”：时间线与详情切换，第三版同时显示“最新生成 / 当前采用”。
4. 回到 PPT 并点击“第一版”：详情显示“历史版本”，当前采用仍为第二版。
5. 点击“全部文件 / 项目总览 / 待处理”：分别看到 M2 / M3 / M5 占位说明。
6. 确认没有“设为当前采用”等写操作（本轮只读）。

DSH 会话内 Chromium 嵌套沙箱无法初始化，验证时使用：

```sh
npm run dev -- --noSandbox -- --disable-gpu
```

该参数仅用于 DSH 环境，普通终端不要携带。

## M1 第三步（IPC 契约与来源校验，已完成）

- `getRuntimeInfo`、`getProjectSnapshot` 返回共享 `Result<T>`，错误码为 `INTERNAL_ERROR`、`UNTRUSTED_SOURCE`。读取失败显示固定中文消息并可重试；内部异常与堆栈只写主进程日志，不进入界面。
- IPC 仅接受当前主窗口的 main frame：同时校验 webContents id、frame process/routing id 与 frame URL，拒绝其他窗口、子框架和已关闭窗口。
- 生产只信任主进程实际加载的 `out/renderer/index.html`，不再放行任意 `file:` 页面；开发只信任 `ELECTRON_RENDERER_URL` 配置的开发服务器 origin。
- 导航层拒绝非可信主框架导航、服务端重定向、非主框架导航、新窗口与 webview 附加。
- 新增 15 个 IPC 测试（`ipc-trust` 9、`ipc-respond` 6），覆盖成功、仓库异常脱敏、其他窗口/子框架/非入口 URL 拒绝。

第三步验证结果：

| 检查 | 结果 |
| --- | --- |
| `npm run test` | 6 文件 / 28 测试通过 |
| `npm run check` | 通过：119 文件、typecheck、lint、28 测试、build、提交标题自测 |
| dev 窗口 CDP | 两个 API 均返回 `{ok:true,...}`；外部导航与 `window.open` 被拦截；renderer 无 `require` / `process` / `ipcRenderer` |
| 生产预览 CDP | file 入口下 API 正常，外部导航与弹窗被拦截 |

## 下一步（M1 剩余）

- 文件列表、项目总览、待处理仍是占位页，等待 M2 / M3 / M5 接入真实数据。
- 采用切换、任务创建、变更导入、真实目录扫描不在本轮范围。
- 生产 CSP、受控应用协议、打包签名与安装包尚未实现。
- Playwright 桌面自动化与远端 CI 实跑待补；本轮提交尚未推送，远端 CI 结果未验证。
- 创建 PR 并完成 M1 收尾验收。

## 已知限制

- 模拟数据只读，不读取或写入用户业务文件夹；快照 `revision=7` 只是模拟版本号。
- DSH 会话内需 `--noSandbox` 才能启动 Electron，普通终端是否无参数启动仍需人工验收。
- 工作台目前只覆盖单项目、产出材料纵向切片；文件/图谱/待处理内容与交互尚未实现。
- 生产入口当前按 `file:` 路径精确比较；未来改用受控 `app://` 协议时需同步更新来源校验与测试。
- IPC 来源校验依赖 Electron frame process/routing id；目前只在 macOS 验证，未做其他平台手工复验。
- 启动包检查不等同于完整 JSON Schema 或桌面应用 E2E；真实文件风险测试在 M2–M5 补齐。
- 当前 package 0.0.0、schemaVersion 1，未升版本、未打标签。

## 每阶段更新

本轮分支 `feat/m1-shell`，小步提交：`597ae01`（lint/测试工具链）、`67f25ad`（领域模型与 MockRepository）、`feab2f5`（工作台界面与交互测试）、`3a32dab`（check 与 CI）、`c736427`（共享 Result 契约）、`24677a3`（IPC 与导航来源校验），以及文档提交。Git 实际接入信息见 REPOSITORY.md。

## 提交与版本规则更新

已要求每个完成并验证的小改动立即独立 commit，格式为英文类型＋中文全角冒号＋中文描述；新增 docs/09-versioning.md。当前 package 0.0.0、schemaVersion 1 保持不变，尚未发布任何桌面版本。

提交格式现有本地 hook 与 CI 检查；克隆后按启动指南启用 hook。版本规范没有触发应用发布。

## 品牌资源（2026-10-20）

用户选择 A「文稿留痕」方向。品牌母版与导出位于 [assets/brand](../assets/brand/README.md)，包含彩色 / 单色 / 反白 SVG、横向组合、七档应用图标 PNG 和原始概念参考。README 已展示新标志。

这是品牌资源交付，不代表已将图标接入工作台或安装包。DSH 后续可复用 SVG 更新侧栏标志，打包阶段再补 ICNS / ICO 与 Electron 配置。软件版本 0.0.0、协议版本 1 不变。

本轮检查：`npm run check` 通过（品牌资源提交时为 115 个文件、类型检查、lint、12 个测试、生产构建、提交标题自测）；5 个 SVG 母版通过 XML / viewBox 检查；10 个 PNG 已核对尺寸，透明 Logo 的 alpha 保留，资源预览已目视核对。
