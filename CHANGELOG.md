# Changelog

本文件记录文脉软件研发变化，不是用户业务材料的修改日志。

## Unreleased

### Fixed

- 修复 `files.scan` 的参数回归：handler 曾把绝对根路径传给 `scanAuthorizedProject`，而该服务第一个参数是 handle 并会在内部 `registry.resolve(handle)`，导致已授权项目的正常扫描也返回 `PROJECT_NOT_FOUND`。现在 handler 直接传校验后的 handle，根路径只由主进程授权表解析；元数据读取与初始化仍保留授权根身份校验。新增 handler 层回归测试（真实临时目录与真实授权表/存储，仅替换 Electron 运行时），覆盖成功扫描、未知 handle/绝对路径拒绝、不可信调用方拒绝与初始化根身份校验。
- 修复元数据操作未复核授权根身份的问题：授权后根目录被移走、原路径换成根外符号链接（或另一普通目录、祖先被替换）时，旧实现可能先在根外创建 `.docwork` 再报错。现在所有读取/初始化/更新都携带授权时的根路径与 dev/ino，并在读取、mkdir、锁文件、临时文件与 rename 前复核；不一致返回 `ROOT_IDENTITY_MISMATCH`，拒绝前不触碰任何内容。新增三个比较根外目录完整内容哈希的回归场景。
- 修复真实目录扫描的目录替换竞态：realpath 校验后、readdir 前路径可被替换为根外符号链接，旧实现可能把根外文件列入结果。现在记录根目录 `dev/ino`，在目录读取与文件元数据读取前后复核 realpath 与身份；检测到替换时终止整次扫描、返回 `SCAN_ABORTED` 并丢弃全部结果，不采用部分输出。

### Changed

- `getRuntimeInfo`、`getProjectSnapshot` 改为返回共享 `Result<T>`；读取失败显示固定中文消息并支持重试，不向界面暴露内部异常或堆栈。
- `npm run check` 现在汇总启动包检查、typecheck、lint、测试与构建；GitHub Actions 使用 `npm ci` 并运行同一检查。
- 每个完成并验证的小改动必须独立提交，标题采用 `英文类型：中文描述`，PR 合并保留小提交。
- 明确软件版本、Git 提交、协议版本与业务文档版本的独立编排，以及 alpha/beta/rc 到正式版的发布规则。

### Added

- M2 第二步：项目元数据初始化与重新读取。打开文件夹默认只读，仅用户点击初始化后创建 `.docwork/project.json`（schemaVersion=1、revision=1、空集合）；使用现有 schema + Ajv 2020 校验，保留已有 ID/分类等数据，损坏或不支持版本不覆盖重建。新增 lockfile 单写者、revision 冲突检查、同目录临时文件 fsync + rename 原子写入，并拒绝管理目录/目标文件符号链接。
- M2 第一小步：原生目录选择与会话内目录授权；只读扫描真实文件夹，在“全部文件”展示相对路径、类型、大小、修改时间并标为未分类；支持手动重新扫描、权限/消失警告与错误重试。忽略内部管理目录，不跟随符号链接，不创建或修改业务文件、project.json、AGENTS.md。
- 工作台顶部接入 A「文稿留痕」Logo：构建时导入 `assets/brand/logo.svg`，保持比例，空 `alt` + `aria-hidden` 避免与相邻名称重复朗读；新增品牌可访问性测试（总计 29 个测试）。
- M1 第三步：共享 `Result<T>` 与 `INTERNAL_ERROR` / `UNTRUSTED_SOURCE` 错误码；IPC 仅信任当前主窗口主框架，生产只信任实际入口文件，开发只信任配置的开发服务器来源；拒绝其他窗口、子框架、外部导航、重定向与弹窗；新增 15 个 IPC 测试（总计 28）。
- 确定 A「文稿留痕」品牌方向：增加彩色、单色、反白 SVG 标志、横向名称组合、七档 PNG 应用图标及使用说明；README 展示品牌标志。
- M1 第二步：纯 TS 领域模型与只读 MockRepository、类型化 `getProjectSnapshot` preload 接口、工作台左侧导航、产出材料三栏视图（材料卡 / 版本时间线 / 只读详情）与里程碑占位页；ESLint + Vitest + Testing Library 工具链与 12 个测试。
- M1 第一步：Electron 44 + React 19 + TypeScript 5.9 + Vite 8 开发环境；最小 main/preload/renderer 窗口与 `window.folio.getRuntimeInfo()` 桥接；提交 `package-lock.json` 与工具链 ADR。
- 本地 commit-msg hook 与 CI 提交/PR 标题检查，要求英文类型和中文描述。

- 文脉 / FolioTrace 产品范围、架构、Agent 协议、目录树、阶段路线和测试标准。
- DSH + deepseek-flash 开发/评审/续作提示词。
- 可离线运行的交互原型：材料管理、版本图谱、外观设置与互动写作流程。
- JSON Schema、合成项目、业务写作规则模板、启动包检查及 GitHub CI。
- 开源许可、贡献指南、Issue/PR 模板与本地/远程版本控制规范。

尚无桌面应用发布。
