# 安全与数据边界

当前是开发启动包，无稳定受支持版本。程序目标是本地处理，不上传业务文档。

请勿在公开 Issue 放真实文档、绝对路径、令牌或漏洞利用中的敏感材料。若仓库已启用 GitHub 私密漏洞报告，使用 Security 页的 Report a vulnerability；未启用时先用不含敏感细节的 Issue 请求私密沟通渠道。不要假定该功能已经启用。

开发应优先防护路径穿越、符号链接逃逸、未受控 IPC、打开可执行文件、Markdown 注入、元数据损坏与历史文件覆盖。具体不变量见 docs/04-agent-protocol.md 与 docs/06-testing.md。
