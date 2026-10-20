# 粘贴到 DSH 的第一条指令

你正在开发“文脉 / FolioTrace”，工作目录是当前仓库根目录。使用当前已选择的 deepseek-flash，不要自行切换模型或配置 API Key。

请先读取 AGENTS.md、docs/STATUS.md、docs/START_HERE.md、docs/01-product.md、docs/03-architecture.md、docs/05-roadmap.md；查看 prototype/index.html 的交互设计。然后检查 git status、Node/npm 与现有依赖状态。

本轮只做 M1，不同时实现整个产品：
1. 以 Electron + React + TypeScript + Vite 搭建桌面壳，按架构分 main/preload/renderer/domain/shared。
2. 建立类型化 window.folio 接口与 MockRepository，renderer 不接触 Node 或 fs。
3. 使用合成数据实现导航、材料卡、版本时间线的最小纵向切片，保留文脉品牌与原型视觉方向。
4. 选择兼容的稳定依赖并提交 package-lock.json；保留已有 npm run check 的启动包检查，加入 typecheck/lint/test/build。
5. 添加最小但有效的隔离与领域测试，运行可执行检查；不能启动 GUI 时说明缺失验收。

先给出具体文件范围与验收点，再实施。不要把 prototype 单文件原样塞入 Electron 当成已完成。不要接模型 API、真实业务材料、云服务或自动更新系统。

使用 feat/m1-shell 分支，不覆盖用户改动；完成后更新 docs/STATUS.md 和 CHANGELOG.md，列出实际验证结果、遗留项和下一阶段入口。代码可提交到本地；推送/PR 根据当前用户授权执行，不合并失败检查的变更。

## 提交要求

每完成并验证一个独立小改动，立即本地 commit，再开始下一项；不要积累到阶段末。标题严格使用 `英文类型：中文描述`（中文全角冒号，无 scope），例如 `docs：补充任务验收说明`。只暂存本次相关改动，保留他人工作。评审若没有修改文件，不制造空提交。版本号按 docs/09-versioning.md 编排，不随每个 commit 自动递增。
