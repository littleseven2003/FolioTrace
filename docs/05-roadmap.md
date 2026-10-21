# 分阶段实现

每阶段独立分支；阶段内每个完成并验证的小改动立即独立 commit，通过验收后用保留提交的 PR 合并。不要一条提示词把整个应用写完。

| 阶段 | 工作范围 | 完成证据 | 建议分支 |
| --- | --- | --- | --- |
| M0 已交付 | 文档、原型、schema、fixture、Git | npm run check | docs/bootstrap |
| M1 | Electron/React/TS/Vite 骨架，typed preload，MockRepository | 可启动窗口；无 Node 暴露；typecheck/lint/test/build；版本锁文件 | feat/m1-shell |
| M2 | 目录选择、扫描、文件分类、project.json 原子存储 | 复制合成项目接入；不搬文件；重启恢复；越界测试 | feat/m2-project-files |
| M3 | 先落地 v2 多文件清单与 v1 迁移，再实现逻辑材料、版本、采用与配套、时间线/总览 | 单文件/主文件＋资源/文件夹版本；迁移保留历史 ID 与指纹；成员变化可见；切换采用不漂移配套；父图无环 | feat/m3-version-graph |
| M4 | 规则安装、索引生成、任务与指令复制 | 保护已有 AGENTS；任务固定输入；生成 JSON 通过 schema | feat/m4-agent-handoff |
| M5 | 事件导入、待处理、文件对账、崩溃恢复 | 合法事件一次导入；坏事件不部分写；重复/并发/漂移测试 | feat/m5-import |
| M6 | 主题、互动流程、可访问性、性能与发布 | 手工桌面验收；本机包；README 说明签名与平台限制 | feat/m6-release |

## M1 的明确边界

只搭壳和三层结构，用合成数据呈现导航和一条时间线；不要同时实现真实目录扫描或导入器。使用当前稳定兼容版本，添加 package-lock.json。npm scripts 应包含 dev、typecheck、lint、test、build、check:docs；check 汇总这些检查。根据实际工具生成配置，不伪造可运行文件。

## 当前推进顺序（2026-10-21）

M2 分类保存及重开流程已由用户测试通过；下一小步依据 [材料与资源设计](10-material-bundles.md) 和 [目录视图任务](../prompts/06-m2-file-tree.md)，增加全部文件的折叠目录/平铺切换与搜索，保持 v1 不变。验收后更新 M2 状态、核对 Draft PR #3 的最新 CI，Ready 后评审合并，保留小提交；批量分类、重命名迁移、自动恢复最近项目后续迭代。

M3 首个任务只实现协议与迁移基础：先提交 ADR 和完整 v2 字段设计，再同步 schema、类型、fixture、兼容性与迁移测试。通过后分别推进单文件版本、多文件清单、版本界面和图谱。M4/M5 须消费已确定的完整成员快照，不另造只包含主文件的新协议。

## 阶段交接格式

写明已实现条目、实际运行命令和结果、截图或人工验收步骤、剩余问题、当前分支/提交、下一步。若验证环境欠缺，把阶段标为“部分完成”，不为赶进度修改标准。
