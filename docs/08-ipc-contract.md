# IPC 契约

## 返回结构（M1 已实现）

renderer 通过 `window.folio` 调用具名方法，所有方法返回 `Promise<Result<T>>`：

```ts
type FolioErrorCode =
  | 'INTERNAL_ERROR'
  | 'UNTRUSTED_SOURCE'
  | 'PROJECT_NOT_FOUND'
  | 'INVALID_PROJECT_PATH'
  | 'PERMISSION_DENIED'
  | 'PATH_OUTSIDE_ROOT'

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: FolioErrorCode; message: string; details?: Record<string, unknown> } }
```

- `INTERNAL_ERROR`：读取或处理失败。界面只显示固定中文消息并允许重试；异常对象与堆栈只写入主进程日志，不进入 `Result` 或界面。
- `UNTRUSTED_SOURCE`：调用窗口、框架或页面 URL 不属于可信入口，直接拒绝。
- `PROJECT_NOT_FOUND`：handle 不存在或会话授权已失效。
- `INVALID_PROJECT_PATH`：所选路径不存在、不是文件夹或不可解析。
- `PERMISSION_DENIED`：目录/文件读取权限不足；扫描内部读取失败也可降级为警告。
- `PATH_OUTSIDE_ROOT`：路径经 realpath 校验后位于项目根目录之外。

尚未实现的错误码在对应方法落地时加入：PROJECT_LOCKED、REVISION_CONFLICT、SCHEMA_INVALID、HASH_MISMATCH、MISSING_FILE、EVENT_ID_CONFLICT、UNSUPPORTED_SCHEMA。

## 调用来源校验（M1 已实现）

- IPC 仅接受当前主窗口的 main frame：校验 webContents id、frame process/routing id 与 frame URL，拒绝其他窗口、子框架和已关闭窗口。
- 生产只信任主进程实际加载的 `out/renderer/index.html`；不能仅凭 `file:` 协议放行。
- 开发只信任 `ELECTRON_RENDERER_URL` 指向的开发服务器 origin。
- 导航层拒绝非可信主框架导航、服务端重定向、非主框架导航、新窗口与 webview 附加。
- renderer 仍不接触 Node、fs、shell 或 `ipcRenderer`。

## 方法

| 方法 | 输入 | 输出 / 效果 |
| --- | --- | --- |
| runtime.getInfo | 无 | `Result<RuntimeInfo>`；应用、Electron 与 Chromium 版本 |
| project.getSnapshot | 无 | `Result<ProjectSnapshot>`；M1 模拟工作台快照，不读写真实项目 |
| projects.choose | 无，调用原生目录选择器 | 已实现（M2）：`Result<ChooseProjectOutcome>`；取消为正常结果 `{canceled:true}`，成功返回 handle 与只读摘要 |
| files.scan | handle | 已实现（M2）：`Result<ProjectScan>`；返回相对路径、类型、大小、修改时间、未分类与警告，只读元数据 |
| projects.get | handle | 未实现（M2 后续）：ProjectSnapshot |
| files.classify | handle, fileIds, role, expectedRevision | 未实现（M2 后续）：新 revision |
| files.open | handle, fileId | 未实现（M2 后续）：受控文档打开结果 |
| documents.create | handle, name, expectedRevision | 未实现（M3）：documentId |
| versions.register | handle, documentId, fileId, parentId, expectedRevision | 未实现（M3）：versionId；计算指纹 |
| versions.adopt | handle, documentId, versionId, expectedRevision | 未实现（M3）：新 revision |
| relations.add | handle, fromVersionId, toVersionId, kind, expectedRevision | 未实现（M3）：relationId |
| tasks.create | handle, typed draft, expectedRevision | 未实现（M4）：taskId + promptText |
| changes.scan | handle | 未实现（M5）：待处理列表与状态 |
| changes.import | handle, eventId | 未实现（M5）：imported / duplicate / needs-attention |
| projections.rebuild | handle | 未实现（M5）：投影 revision |
| settings.update | allowed preferences | 未实现（M6）：持久化后的偏好 |

主进程发 project:changed {handle,revision}，前端重新读取，不发绝对路径全文。取消订阅函数必须可调用，避免组件重挂载泄漏。

## M2 只读扫描语义

- 原生目录选择器只在主进程调用；授权后只返回 handle 与显示名，根路径留在主进程。
- `files.scan` 只接受当前会话已授权的 handle，不接受 renderer 传入的根路径。
- 扫描忽略 `.git`、`.docwork`、`node_modules`、`.svn`、`.hg` 等内部目录；跳过所有符号链接；目录经 realpath 校验必须位于根目录内。
- 权限不足、目录不可读、扫描期间文件消失不会中断整次扫描，返回 `warnings`；文件初始分类为 `unclassified`。
- 扫描不创建或修改业务文件、`project.json`、`AGENTS.md`，也不登记版本或关系。
