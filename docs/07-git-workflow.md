# 本地与远程版本控制

## 仓库范围

Git 跟踪软件代码、文档、原型、协议与合成 fixture。业务文稿的版本图谱是文脉功能，不等于 Git 仓库；MVP 不自动对用户业务目录执行 git init、add 或 push。

## 个人 / 小团队工作流

main 保持可演示；使用短期 feat/…、fix/…、docs/… 分支，不加长期 develop。一个阶段可以一个 PR，但每个完成且验证的小改动必须立即独立 commit。PR 合并使用 merge commit 保留这些小提交；不要 squash 或 rebase 改写已分享的提交。

```sh
git switch main
git pull --ff-only
git switch -c feat/m1-shell
# 实现并检查
npm run check
git add <明确的相关文件>
git diff --cached
git commit -m "feat：添加桌面壳与类型化桥接"
git push -u origin feat/m1-shell
# 在 GitHub 创建 PR，合并后删除已合并分支
```

## 小步提交规则（从本次规范起生效）

标题严格为 `类型：描述`：类型是小写英文，冒号是中文全角 `：`，描述以中文表意，可包含 API、文件名等必要英文。不使用 scope、不添加 emoji。正文可补充原因、验证结果和关联 Issue。

| 类型 | 用途 | 示例 |
| --- | --- | --- |
| feat | 新功能 | feat：增加项目总览入口 |
| fix | 缺陷修复 | fix：修复重复记录被二次导入 |
| docs | 文档 | docs：补充版本发布规则 |
| style | 格式与视觉样式 | style：调整版本卡片间距 |
| refactor | 保持行为的重构 | refactor：拆分版本关系计算逻辑 |
| perf | 性能 | perf：限制文件哈希并发数量 |
| test | 测试 | test：补充路径越界用例 |
| build | 构建与依赖 | build：配置桌面应用打包 |
| ci | 自动检查 | ci：增加提交标题检查 |
| chore | 维护 | chore：配置本地提交检查 |
| revert | 回退 | revert：回退异常的文件监听修改 |
| release | 版本发布准备 | release：准备发布 0.1.0 正式版 |

**粒度**：改一个按钮、补一条规则、修一个 bug，只要构成完整可验收改动，就检查并 commit。不能等 M1 全部结束才提交。相关实现/测试/必要文档是同一个原子改动，不按每个文件拆提交。不要求每次保存都提交、不制造空提交、不把已知失败代码当作完成提交。

**频率**：每个小改动本地 commit；完成一轮工作或切换设备前 push 特性分支。commit 不等于发布，也不要求每次 commit 升版本。中途不能完成时，用 stash 或明确说明未完成状态，不为了凑提交伪造检查通过。

本规范不重写已有 bf8a1c9、e83371f 两个启动提交。后续人工、Agent、PR 标题与合并提交均遵循该格式；GitHub 合并时手动指定中文描述标题。历史回退使用 revert，默认自动生成的英文标题也要改为本规范。

代码和必要的文档一起提交。不要强推 main；重写个人特性分支前确认无人基于它开发，使用 --force-with-lease 而非 --force。

## 建议主分支保护

公开仓库 main 要求 PR、状态检查 `starter-check`；阻止 force push 与删除。个人模式无需必需审阅人数，避免锁死自己；小团队可设 1 位审核者。M1 CI job 名变化需同步 required checks。保护是否已启用，以 docs/REPOSITORY.md 为准，不把建议写成事实。

## 发布

当前不标可安装版本。M6 验收完成后更新 CHANGELOG，打 v0.1.0 标签并发布安装包，说明测试平台与签名状态。以后遵守 SemVer，协议破坏性变化提供迁移。大二进制不要反复进 Git，安装包放 Releases。

## 本地恢复

改动先 diff；需要切任务可提交 WIP 到特性分支或 stash，记录恢复方式。不使用 reset --hard 清掉不认识的改动。误操作先看 reflog，不覆盖远程来“恢复”。

## 远程尚未建立时

scripts/connect-remote.sh <仓库URL> 只添加 origin，不创建、不上传。确认内容后首次推送 main。账号登录在用户终端进行，不把 token 写到仓库、文档或聊天。不要提交本地绝对路径、真实业务样本或环境文件。
