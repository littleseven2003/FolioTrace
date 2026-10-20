# 测试与验收

启动包检查只是 M0 门槛。M1 起使用 Vitest 测纯领域函数与服务；React Testing Library 测用户交互；桌面自动化在确认 Electron 版本兼容后用 Playwright，macOS 原生打开文件保留手工测试。

## 必测矩阵

| 层 | 场景 | 期待 |
| --- | --- | --- |
| 路径 | ../、绝对路径、UNC、盘符、symlink、写入时父目录变化 | 拒绝，根外不读写 |
| 导入 | 同事件两次；同 ID 不同内容 | 一次成功；冲突拒绝 |
| 事务 | 2 个产出中第 2 个缺文件 | 0 个被导入，revision 不变 |
| 版本 | 跨材料父版、循环、未知父版 | 拒绝 |
| 关系 | 配套到旧版后改“当前采用” | 原端点不变 |
| 指纹 | 任务参考文件被替换、历史输出原地编辑 | 待处理，旧 sha 不改 |
| 故障 | 快照 rename 前后崩溃、投影生成失败 | 旧或新完整快照，无半提交，可重建投影 |
| 并发 | 两实例写、同 revision 更新 | 单写锁或 revision 冲突，不能丢更新 |
| 状态 | Agent 新版导入 | candidate；不自动 current |
| 分类 | 新文件/排除文件 | 不默认加入参考 |
| UI | 键盘、长文件名、无项目、空版本、权限拒绝 | 可理解且可恢复 |
| 扫描 | 关闭应用期间文件改变，再打开 | 全量对账发现变化 |

## 合成样例验收

把 examples/demo-project 复制到临时业务目录，勿直接改仓库 fixture。初始 revision=1，PPT 对应的 Markdown 材料 doc-slides 使用 v-slides-1；报告 v-report-1 配套它。导入 event-demo-001 后增加 v-slides-2，仍采用 v-slides-1；再导入无变化。用户采用 v-slides-2 后，报告仍对应 v-slides-1，应提示核对配套。

## 手工桌面路径

开目录 -> 分类 -> 版本登记 -> 任务生成 -> 在外部 Agent 生成记录 -> 待处理/导入 -> 查看图谱 -> 设为采用 -> 退出重启。验证每一步的实际磁盘文件，而不是仅截图。

## GitHub CI

当前 ci.yml 只跑 M0 check。M1 必须接入 npm ci、typecheck、lint、unit、build，并提交 lockfile。M6 增加 macOS 构建；未验证平台不宣称支持。禁止为了绿色状态删掉失败测试或使用 continue-on-error。
