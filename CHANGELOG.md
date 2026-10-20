# Changelog

本文件记录文脉软件研发变化，不是用户业务材料的修改日志。

## Unreleased

### Changed

- `npm run check` 现在汇总启动包检查、typecheck、lint、测试与构建；GitHub Actions 使用 `npm ci` 并运行同一检查。
- 每个完成并验证的小改动必须独立提交，标题采用 `英文类型：中文描述`，PR 合并保留小提交。
- 明确软件版本、Git 提交、协议版本与业务文档版本的独立编排，以及 alpha/beta/rc 到正式版的发布规则。

### Added

- M1 第二步：纯 TS 领域模型与只读 MockRepository、类型化 `getProjectSnapshot` preload 接口、工作台左侧导航、产出材料三栏视图（材料卡 / 版本时间线 / 只读详情）与里程碑占位页；ESLint + Vitest + Testing Library 工具链与 12 个测试。
- M1 第一步：Electron 44 + React 19 + TypeScript 5.9 + Vite 8 开发环境；最小 main/preload/renderer 窗口与 `window.folio.getRuntimeInfo()` 桥接；提交 `package-lock.json` 与工具链 ADR。
- 本地 commit-msg hook 与 CI 提交/PR 标题检查，要求英文类型和中文描述。

- 文脉 / FolioTrace 产品范围、架构、Agent 协议、目录树、阶段路线和测试标准。
- DSH + deepseek-flash 开发/评审/续作提示词。
- 可离线运行的交互原型：材料管理、版本图谱、外观设置与互动写作流程。
- JSON Schema、合成项目、业务写作规则模板、启动包检查及 GitHub CI。
- 开源许可、贡献指南、Issue/PR 模板与本地/远程版本控制规范。

尚无桌面应用发布。
