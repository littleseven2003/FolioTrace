# ADR 0001：本地桌面与单一项目快照

状态：接受（启动包设计决策）

上下文：主要工作发生在本地文件夹，写作在外部 Agent，个人/小团队维护，首版不需要账号或服务端。

决策：Electron/React/TypeScript；领域与文件系统隔离；project.json 权威快照 + 不可变 Agent 输入事件 + 可重建 Markdown 投影。安装包与原型分离；暂不使用数据库。

代价：Electron 包体积较大；JSON 每次全量写入适合个人规模，需要限制项目规模和锁；不支持共享盘多人同时写。未来若数据增长，迁移到数据库必须保留导出/携带能力并有 ADR，不静默添加第二份权威数据。

参考（2026-10-20 查阅）：
- https://www.electronjs.org/docs/latest/tutorial/security
- https://vite.dev/guide/
- https://v2.tauri.app/start/prerequisites/ （备选方案比较）

Electron 官方建议隔离 renderer、限制 IPC 和导航；本项目据此让文件操作留在主进程。具体依赖版本在 M1 选择与锁定。
