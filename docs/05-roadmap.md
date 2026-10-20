# 分阶段实现

每阶段独立分支与提交；通过验收后再合并。不要一条提示词把整个应用写完。

| 阶段 | 工作范围 | 完成证据 | 建议分支 |
| --- | --- | --- | --- |
| M0 已交付 | 文档、原型、schema、fixture、Git | npm run check | docs/bootstrap |
| M1 | Electron/React/TS/Vite 骨架，typed preload，MockRepository | 可启动窗口；无 Node 暴露；typecheck/lint/test/build；版本锁文件 | feat/m1-shell |
| M2 | 目录选择、扫描、文件分类、project.json 原子存储 | 复制合成项目接入；不搬文件；重启恢复；越界测试 | feat/m2-project-files |
| M3 | 逻辑材料、版本、采用与配套、时间线/总览 | 图谱真实数据驱动；切换采用不漂移配套；父图无环 | feat/m3-version-graph |
| M4 | 规则安装、索引生成、任务与指令复制 | 保护已有 AGENTS；任务固定输入；生成 JSON 通过 schema | feat/m4-agent-handoff |
| M5 | 事件导入、待处理、文件对账、崩溃恢复 | 合法事件一次导入；坏事件不部分写；重复/并发/漂移测试 | feat/m5-import |
| M6 | 主题、互动流程、可访问性、性能与发布 | 手工桌面验收；本机包；README 说明签名与平台限制 | feat/m6-release |

## M1 的明确边界

只搭壳和三层结构，用合成数据呈现导航和一条时间线；不要同时实现真实目录扫描或导入器。使用当前稳定兼容版本，添加 package-lock.json。npm scripts 应包含 dev、typecheck、lint、test、build、check:docs；check 汇总这些检查。根据实际工具生成配置，不伪造可运行文件。

## 阶段交接格式

写明已实现条目、实际运行命令和结果、截图或人工验收步骤、剩余问题、当前分支/提交、下一步。若验证环境欠缺，把阶段标为“部分完成”，不为赶进度修改标准。
