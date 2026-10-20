# IPC 契约草案

M1 把此表落实为 shared 类型与主进程 schema，renderer 调用 window.folio 的具名方法。返回 Promise<Result<T>>，Result 为 {ok:true,value:T} 或 {ok:false,error:{code,message,details?}}。不要提供通用 readFile/writeFile/exec。

M1 当前只实现只读模拟方法：`window.folio.getProjectSnapshot()`（IPC 频道 `project:get-snapshot`）返回 MockRepository 的项目快照；`getRuntimeInfo()` 返回应用与运行时版本。两者尚未包 `Result<T>` 与错误码，M2 接入真实项目时统一补齐。

| 方法 | 输入 | 输出 / 效果 |
| --- | --- | --- |
| runtime.getInfo | 无 | 应用版本、Electron 与 Chromium 版本 |
| project.getSnapshot | 无 | M1 模拟 ProjectSnapshot；不读写真实项目 |
| projects.choose | 无，调用原生目录选择器 | projectHandle + ProjectSummary；取消单独结果 |
| projects.get | handle | ProjectSnapshot |
| files.rescan | handle | ScanSummary，不自动改变历史 |
| files.classify | handle, fileIds, role, expectedRevision | 新 revision |
| files.open | handle, fileId | 受控文档打开结果 |
| documents.create | handle, name, expectedRevision | documentId |
| versions.register | handle, documentId, fileId, parentId, expectedRevision | versionId；计算指纹 |
| versions.adopt | handle, documentId, versionId, expectedRevision | 新 revision |
| relations.add | handle, fromVersionId, toVersionId, kind, expectedRevision | relationId |
| tasks.create | handle, typed draft, expectedRevision | taskId + promptText |
| changes.scan | handle | 待处理列表与状态 |
| changes.import | handle, eventId | imported / duplicate / needs-attention |
| projections.rebuild | handle | 投影 revision |
| settings.update | allowed preferences | 持久化后的偏好 |

主进程发 project:changed {handle,revision}，前端重新读取，不发绝对路径全文。取消订阅函数必须可调用，避免组件重挂载泄漏。error code 至少涵盖 PATH_OUTSIDE_ROOT、PROJECT_LOCKED、REVISION_CONFLICT、SCHEMA_INVALID、HASH_MISMATCH、MISSING_FILE、EVENT_ID_CONFLICT、UNSUPPORTED_SCHEMA、PERMISSION_DENIED。
