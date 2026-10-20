# 仓库接入记录

核验日期：2026-10-20

- 公开仓库：https://github.com/littleseven2003/FolioTrace
- origin：https://github.com/littleseven2003/FolioTrace.git
- 默认分支：main；本地 main 跟踪 origin/main。
- 首次提交：bf8a1c9，开发启动包。
- 首次 GitHub CI：通过，https://github.com/littleseven2003/FolioTrace/actions/runs/39357915569 。
- 本地启动包检查：npm run check 通过。
- 许可证：MIT；Lucide 许可另行保留。

## 已配置主分支保护

普通贡献要求 PR；合并前必须通过 starter-check，且分支需与 main 同步；要求解决讨论。个人阶段不强制他人批准（required approvals=0）。禁止普通强推及删除 main。

管理员未纳入强制保护，保留初始化和恢复时的绕过能力；日常仍遵循特性分支 + PR，不以管理员权限跳过失败检查。小团队扩大后可启用 enforce_admins，并要求 1 位审核者。

Git 作者身份仅在此仓库配置为 GitHub 账号及 noreply 地址，未修改全局设置。远程仓库不包含真实业务材料、模型凭据或用户本地路径。

CI 已覆盖启动包检查、typecheck、lint、测试、构建与提交标题校验；作业 ID 保持 `starter-check` 以兼容现有分支保护。本轮 `feat/m1-shell` 提交尚未推送，远端 CI 结果待推送后验证。
