# 工作台与外部 Agent 协议 v1

## 适用范围

本页与当前三套 schema 是 v1 的现行契约，仍只支持单文件版本。多文件材料方向见 [材料与配套资源设计](10-material-bundles.md)，计划在 M3 以 v2 同步迁移 project/change/task 与业务模板；本次文档更新不改变事件格式。不得用多个互不关联的 v1 output 冒充一个多文件版本，也不得把目录路径作为 fileId 传入。

## 写入者

| 对象 | 唯一写入方 | 说明 |
| --- | --- | --- |
| .docwork/project.json | 文脉 | 权威快照，含导入账本与采用状态 |
| .docwork/tasks/<taskId>.json | 文脉 | 固定任务输入，已发出不原地改写 |
| .docwork/changes/<eventId>.json | Agent | 每次追加一份；先 .tmp 后 rename |
| PROJECT_INDEX.md、CHANGELOG.md | 文脉 | 从快照重建；管理区以外保留用户文本 |
| AGENTS.md 管理片段 | 文脉 | 写作规则；安装前给用户预览 |
| 实际产出 | Agent | 新文件，禁止覆盖历史快照 |

软件自己的 CHANGELOG.md 和业务项目 CHANGELOG.md 是两个不同对象。

## 实体与字段

以 schemas/project.schema.json、change.schema.json、task.schema.json 为语法契约。ID 是非空稳定字符串，生产建议随机 UUID 加前缀。时间使用带时区 ISO-8601；文件名沿用 YYYYMMDDHHMM-名称，同分钟冲突追加 -02，不覆盖。显示按用户时区格式化，不能把文件名时间当权威创建时间。

File.role 为 reference/process/output/excluded/unclassified。Version 绑定 documentId、fileId、父 versionId、登记 SHA-256、摘要和参考快照。Document.currentVersionId 只能指向自己的版本或 null。Relation 的两个端点必须存在且不同，不可从名称猜测。

## 任务

任务固定 projectId、baseRevision、目标 documentId、baseVersionId（初稿可 null）、参考 fileId+sha256+relativePath、requirements、syncCompanions。任务指定的版本优先于全局采用版；来源文件与快照不符则先停止并要求新任务或明确确认。

初稿材料由工作台先创建逻辑 documentId，再发任务；Agent 不在事件中擅自创建新逻辑材料。仅考虑同步已有材料；需要新增材料时先登记。

## 回交记录

一个事件含 eventId、projectId、taskId、createdAt、producer、outputs[]。每个 output 提供新的 file 和 version；可有 relations[] 连接新旧版本。当前采用字段不允许出现在变更记录中。参考样例 examples/demo-project/.docwork/changes/event-demo-001.json。

Agent 先保存产出并计算内容 SHA-256，再写唯一 eventId.tmp，完成后 rename 为 .json。工作台忽略 tmp；无记录的文件进入未登记列表。错误事件原文件保留供排查；Agent 修正后使用新 eventId，工作台可将原错误项标记被替代。

## 导入算法（必须做成独立可测试函数与服务）

1. 持锁并加载最新 project.json；JSON Schema 校验输入。限制 JSON 文件 1 MiB、每事件 50 个产出、单条摘要 2000 字；超限进入待处理。
2. 对原始事件字节计算 SHA-256；同 eventId 且同摘要已导入则 no-op；同 ID 不同摘要拒绝为冲突。
3. projectId/taskId 必须匹配已登记项目与任务；校验 documentId、父版本、路径、文件大小和实际 SHA-256；所有新增 ID 与路径不可冲突。
4. 父版本只能属于同材料，版本图不可成环。Relation 可以引用本事件新增版本，先构建临时候选集合再验证端点。
5. 校验任务固定的基础版本与参考指纹。baseRevision 过期不直接覆盖：如果相关引用与文件指纹未变，允许从旧版生成候选分支；否则进入待修正。不改当前采用版。
6. 所有产出一次性成功或全部拒绝。将实体、任务状态、导入账本加入同一个新快照，revision+1，然后原子写入。
7. 提交后生成 PROJECT_INDEX 和 CHANGELOG 的管理区域，并刷新 UI；失败可重试重建。重复 watcher 通知不能增加第二个版本。

## 不变量

所有文件路径在项目根内；同一 fileId 一条登记，v1 的每份单文件产出对应一个版本；所有父节点存在且同材料；参考 fileId 存在；当前采用属于本材料；事件全有或全无；采用变化不会改变配套端点。

原地修改：保存旧 sha256，不更新旧快照来掩盖变化；标记 drift，用户另存新文件后登记新版。重命名仅在唯一内容匹配且用户确认时更新文件定位；多个同 hash 不自动匹配。删除只标记 missing，不删除版本历史。

## 管理区与恢复

所有生成 Markdown 用 `<!-- FOLIOTRACE:BEGIN -->` 与 END 标记。发现同名文件无标记，先预览并取得用户操作确认后追加片段；不清空既有文件。检测到管理区手工改动时保存副本并提示再生成。启动时检查快照可读性、备份与投影 revision；不可因 JSON 损坏自动初始化空项目。
