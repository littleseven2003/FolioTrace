# 架构与结构树

## 决策

Electron + React + TypeScript + Vite；单仓库、单应用，不使用微服务或 monorepo。优先用同一语言完成文件处理与界面，降低个人/小团队的切换成本。代价是桌面包体积较大，MVP 接受。Tauri 留作后续备选，不在 M1 同时维护两套桌面壳。

存储为业务文件夹内 `.docwork/project.json`，是唯一权威快照；MVP 不再加 SQLite。独立的变更 JSON 是 Agent 输入，索引/日志是可重建投影，不是第二份真相。应用级最近项目列表、主题偏好存 Electron userData，不记录到软件仓库。

```text
renderer (React UI)
       │ typed window.folio API
preload (contextBridge, 最小方法集合)
       │ 校验过的 IPC
main/services (项目、扫描、任务、导入、投影)
       │
domain (纯 TS 模型、验证、图关系) + adapters/fs (路径、锁、原子文件)
       │
用户选择的业务文件夹
```

## 现有启动包

```text
FolioTrace/
├── AGENTS.md                 软件开发规则
├── README.md / CHANGELOG.md / LICENSE
├── CONTRIBUTING.md / SECURITY.md / THIRD_PARTY_NOTICES.md
├── docs/                     PRD、架构、协议、路线、测试、Git 与交接
├── prompts/                  DSH 首轮、阶段、评审、续作、修复提示词
├── prototype/index.html      已确认的交互原型
├── schemas/                  project/change/task JSON Schema
├── examples/demo-project/    可验证的纯文本合成项目
├── templates/workspace/      业务写作 Agent 规则与生成索引示例
├── scripts/                  启动包检查与远程接入
└── .github/                  CI、Issue 与 PR 模板
```

## 源码树目标（M1 第二步已创建 main/preload/renderer/domain/shared 与 tests）

当前已创建 `src/main`（index、ipc、mocks、services 含 scanner/registry）、`src/preload`、`src/renderer`（app、components、features/materials、features/files、hooks、lib、styles）、`src/domain`、`src/shared` 与 `tests/unit`、`tests/integration`；下面目录树中的 adapters/fs、tasks、graph 等仍待后续阶段创建。

```text
src/
├── main/
│   ├── index.ts
│   ├── ipc/                  白名单 handlers、sender 与输入校验
│   └── services/             project, scan, task, import, projection
├── preload/index.ts          类型化窄接口，不暴露 ipcRenderer
├── renderer/
│   ├── app/                  布局、路由、错误边界
│   ├── features/             projects, files, versions, graph, tasks, inbox
│   ├── components/           共用控件、弹窗、空状态
│   └── styles/               tokens、主题和减少动态效果
├── domain/                   model, validators, version-graph, importer
├── adapters/fs/              safe-path, atomic-store, lock, watcher
└── shared/                   IPC 契约和 Result 类型

tests/{unit,integration,e2e}/
```

## 模块边界

renderer 不 import fs/child_process；preload 只暴露白名单业务方法。main 必须检查 IPC sender、项目 handle 有效性、输入 schema 和相对路径；不能信任前端传来的根路径。目录由原生选择器登记为会话 handle，业务操作只接收 handle+ID。

contextIsolation=true、nodeIntegration=false、sandbox=true；拒绝任意窗口导航、危险 openExternal 和权限请求。生产使用受控应用协议和 CSP；导入 Markdown 只作为文本或经消毒的渲染，不能执行 HTML。Agent 写来的 JSON 不可变成 shell 命令。

## 文件服务

不跟随 symlink，拒绝根外路径、绝对路径、..、NUL、URL、Windows 盘符/UNC。创建文件前验证最近存在父目录的 realpath；最终读取/写入再确认边界。MVP 文档打开白名单包括 docx/pptx/xlsx/pdf/md/txt/csv，拒绝可执行与脚本文件，不通过 shell 拼接打开。

首次扫描只读 metadata；哈希在登记版本/资料快照时流式计算，后台限制并发（建议 2）。忽略 .git、node_modules、锁、临时文件、投影产物；业务 `.docwork/changes/*.json` 单独扫描。fs watcher 只是刷新提示；应用打开、恢复焦点与手动刷新都会重新对账。

## 一致性

一个业务项目同时仅一个文脉写入实例，跨进程 lockfile + project.revision 乐观检查；锁过期需核实进程死亡，不能只凭时间覆盖。MVP 不支持网络共享目录上的协同写入。

project.json 使用同目录临时文件 -> fsync -> 原子 rename，保留上一个有效快照；失败不留下半个快照。导入事件及 importedEvents 账本在同一个 JSON 提交。提交后再生成索引和日志；投影失败不回滚权威快照，标记待重建。Agent 只追加自己的变更记录，不争用 project.json。

## 数据迁移

schemaVersion=1；未知高版本只读打开并提示升级。每次迁移先备份，纯函数迁移、失败恢复、测试旧 fixture。导出的 AGENTS.md 仅维护带标记片段；用户已有同名文件不得覆盖全文。
