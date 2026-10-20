# 文脉 · FolioTrace

<img src="assets/brand/logo.svg" width="100" alt="文脉标志：叠页构成 F，连接节点表示版本延续" />

让每一版有来处，让每份材料有联系。

面向个人与小团队的本地文档材料工作台：管理参考范围、过程材料、版本历史和跨文件配套关系。写作继续在 Codex、DSH 等外部 Agent 中完成。

> 当前阶段：M1 第二步开发中。已有可启动的工作台：左侧导航、三份模拟产出材料、版本时间线与只读版本详情；尚未实现真实目录扫描、版本图谱、任务管理或 Agent 接入，也还没有可安装包。不要把模拟数据或原型中的操作当作真实文件管理。

## 从这里开始

1. 阅读 [开发启动指南](docs/START_HERE.md)。
2. 用浏览器打开 [交互原型](prototype/index.html)。
3. 将 [DSH 首轮提示词](prompts/00-bootstrap.md) 交给开发 Agent。
4. 按 [阶段任务](docs/05-roadmap.md) 实现，每次只完成一个可验收的小阶段。

## 已确定的体验

- 文件夹不搬家，工作台标记文件用途与逻辑材料。
- 每份材料有独立版本；“最新生成”不等于“当前采用”。
- 项目总览用不同颜色表达材料，用实线表达版本延续、虚线表达配套关系。
- 报告、PPT、演讲稿可以绑定具体版本；关系不随“当前采用”漂移。
- 工作台生成任务，Agent 另存文件并提交记录，工作台检查并生成索引与日志。
- 简约背景、可配置强调色、开源图标和可关闭的微动效。

品牌图标与使用说明见 [品牌资源](assets/brand/README.md)。

## 技术方向

Electron + React + TypeScript + Vite，macOS 优先，保留跨平台结构。JSON 项目数据跟随业务文件夹；不部署云服务，不要求模型 API Key。

## 本地开发（Node.js 22.12+）

```sh
npm install
npm run dev
```

启动后进入“产出材料”工作台：可切换 PPT、详细报告、演讲稿，点击版本查看只读详情；全部文件、项目总览、待处理为明确的后续里程碑占位。退出用 `Cmd+Q` 或终端 `Ctrl+C`。

完整本地检查（启动包、类型、lint、测试、构建）：

```sh
npm run check
```

也可单独运行 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。

本轮实际验证环境与已知限制见 [开发状态](docs/STATUS.md)。

## 导航

- [产品需求](docs/01-product.md) · [交互说明](docs/02-ux.md)
- [架构与目录树](docs/03-architecture.md) · [协议](docs/04-agent-protocol.md)
- [测试验收](docs/06-testing.md) · [Git 与提交](docs/07-git-workflow.md) · [版本编排](docs/09-versioning.md)
- [开发状态与交接](docs/STATUS.md) · [贡献指南](CONTRIBUTING.md)

## 开源与隐私

MIT 协议。Lucide 图标保留其 ISC / MIT 许可，见 [第三方声明](THIRD_PARTY_NOTICES.md)。仓库仅收录软件、合成样例和文档；真实业务材料不进入本仓库。小团队开发本软件，不等于 MVP 已支持多人同时编辑一个业务项目。
