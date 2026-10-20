# 从开发启动包开始

## 当前交付范围

此仓库准备了开发依据和原型，没有预先生成空壳应用或安装大量依赖。由 DSH + deepseek-flash 分阶段构建真实程序。`deepseek-flash` 是用户选择的模型名称；不预设它的上下文窗口、工具权限、自动读规则行为或特定 API 参数。

## 推荐使用方式

1. 在 DSH 中打开仓库根目录。
2. 把 prompts/00-bootstrap.md 全文作为首轮指令。
3. 完成 M1 后，每轮使用 prompts/01-phase-task.md，替换阶段编号、验收点。
4. 每次任务结束检查 docs/STATUS.md，先用真实结果验收，再进入下一阶段。
5. 上下文中断时使用 prompts/03-resume.md，不需要重发整段历史对话。

## 两种文件夹，务必分开

- **本仓库**：软件源码、研发文档、CI、HTML 原型。根 AGENTS.md 约束软件开发。
- **用户业务项目**：用户选择的实际文档目录，由文脉管理。其 AGENTS.md 约束业务写作，来源是 templates/workspace/AGENTS.md。

真实业务资料放仓库外。仓库内 examples/demo-project 只是合成文本样例，可复制到临时目录做验收。

## 先看什么

| 顺序 | 文件 | 作用 |
| --- | --- | --- |
| 1 | docs/STATUS.md | 已完成什么、下一步是什么 |
| 2 | docs/01-product.md | 必须实现与明确不做的内容 |
| 3 | docs/02-ux.md + prototype/index.html | 页面与交互目标 |
| 4 | docs/03-architecture.md | 目录和模块边界 |
| 5 | docs/04-agent-protocol.md + schemas/ | 文件协议与一致性规则 |
| 6 | docs/05-roadmap.md + docs/06-testing.md | 分阶段任务与验收 |

## 开发前置检查

Node.js 至少 22.12；M1 时选仍受支持且满足依赖要求的稳定 LTS，固定工具链版本。记录 node/npm 版本。不要用 --force 或 --legacy-peer-deps 掩盖冲突。Electron/构建工具的具体版本以 M1 当天官方兼容性为准，记录到 lockfile 与 ADR。

M0 的 `npm run check` 只检查启动包，不代表桌面程序已经构建通过。Git 仓库状态看 docs/REPOSITORY.md。
