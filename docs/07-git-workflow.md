# 本地与远程版本控制

## 仓库范围

Git 跟踪软件代码、文档、原型、协议与合成 fixture。业务文稿的版本图谱是文脉功能，不等于 Git 仓库；MVP 不自动对用户业务目录执行 git init、add 或 push。

## 个人 / 小团队工作流

main 保持可演示；使用短期 feat/…、fix/…、docs/… 分支，不加长期 develop。一个阶段一个 PR，必要时拆成数个完整小提交。

```sh
git switch main
git pull --ff-only
git switch -c feat/m1-shell
# 实现并检查
npm run check
git add <明确的相关文件>
git diff --cached
git commit -m "feat(shell): add desktop shell and typed preload"
git push -u origin feat/m1-shell
# 在 GitHub 创建 PR，合并后删除已合并分支
```

提交类型：feat / fix / docs / test / refactor / chore。代码和必要的文档一起提交。不要强推 main；重写个人特性分支前确认无人基于它开发，使用 --force-with-lease 而非 --force。

## 建议主分支保护

公开仓库 main 要求 PR、状态检查 `starter-check`；阻止 force push 与删除。个人模式无需必需审阅人数，避免锁死自己；小团队可设 1 位审核者。M1 CI job 名变化需同步 required checks。保护是否已启用，以 docs/REPOSITORY.md 为准，不把建议写成事实。

## 发布

当前不标可安装版本。M6 验收完成后更新 CHANGELOG，打 v0.1.0 标签并发布安装包，说明测试平台与签名状态。以后遵守 SemVer，协议破坏性变化提供迁移。大二进制不要反复进 Git，安装包放 Releases。

## 本地恢复

改动先 diff；需要切任务可提交 WIP 到特性分支或 stash，记录恢复方式。不使用 reset --hard 清掉不认识的改动。误操作先看 reflog，不覆盖远程来“恢复”。

## 远程尚未建立时

scripts/connect-remote.sh <仓库URL> 只添加 origin，不创建、不上传。确认内容后首次推送 main。账号登录在用户终端进行，不把 token 写到仓库、文档或聊天。不要提交本地绝对路径、真实业务样本或环境文件。
