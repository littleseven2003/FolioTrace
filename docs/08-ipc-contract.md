# IPC 契约

## 返回结构（M1 已实现）

renderer 通过 `window.folio` 调用具名方法，所有方法返回 `Promise<Result<T>>`：

```ts
type FolioErrorCode = 'INTERNAL_ERROR' | 'UNTRUSTED_SOURCE'

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: FolioErrorCode; message: string; details?: Record<string, unknown> } }
```

- `INTERNAL_ERROR`：读取或处理失败。界面只显示固定中文消息并允许重试；异常对象与堆栈只写入主进程日志，不进入 `Result` 或界面。
- `UNTRUSTED_SOURCE`：调用窗口、框架或页面 URL 不属于可信入口，直接拒绝。

其余计划错误码在实现对应方法时加入：PATH_OUTSIDE_ROOT、PROJECT_LOCKED、REVISION_CONFLICT、SCHEMA_INVALID、HASH_MISMATCH、MISSING_FILE、EVENT_ID_CONFLICT、UNSUPPORTED_SCHEMA、PERMISSION_DENIED。

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
| project.getSnapshot | 无 | `Result<ProjectSnapshot>`；M1 为 MockRepository 只读快照，不读写真实项目 |
| projects.choose | 无，调用原生目录选择器 | 未实现（M2）：projectHandle + ProjectSummary；取消单独结果 |
| projects.get | handle | 未实现（M2）：ProjectSnapshot |
| files.rescan | handle | 未实现（M2）：ScanSummary，不自动改变历史 |
| files.classify | handle, fileIds, role, expectedRevision | 未实现（M2）：新 revision |
| files.open | handle, fileId | 未实现（M2）：受控文档打开结果 |
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
