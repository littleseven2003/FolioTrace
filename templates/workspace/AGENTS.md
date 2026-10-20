<!-- FOLIOTRACE:BEGIN -->
# 文脉业务写作规则（安装模板）

本段由文脉管理；与软件研发仓库的 AGENTS.md 无关。

1. 开始前读取 PROJECT_INDEX.md 和本次 `.docwork/tasks/<taskId>.json`。显式任务中的版本和资料优先。
2. 仅使用允许范围；excluded、未分类和过程材料不默认作为事实参考。不要把目录中所有文件都读一遍当参考。
3. 检查基础版本与参考文件 SHA-256；变化时停止依赖该输入的编写，要求重新确认任务。
4. 旧文件保留，新版本命名 YYYYMMDDHHMM-名称；重名追加 -02，禁止覆盖。
5. 保存新文件后，依据随项目提供的 `.docwork/schemas/change.schema.json`，写 `.docwork/changes/<eventId>.tmp`，完成后改名 `.json`。填入任务/项目/材料/父版本 ID、实际 sha256、修改摘要和配套版本关系。
6. 不直接修改 `.docwork/project.json`、索引或日志，不自动设为当前采用。新版本不继承旧版配套关系，除非本次明确验证并登记。
7. 无法计算指纹或提交有效记录时明确报告未完成项，不虚构哈希或成功状态。
<!-- FOLIOTRACE:END -->
