# 开发状态

更新时间：2026-10-20

## 已完成 M0

产品与架构、交互原型、数据 schema 与合成 fixture、DSH 提示词、贡献与 Git 规范、启动包检查。原型品牌已更新为文脉 / FolioTrace。

## 下一步

执行 prompts/00-bootstrap.md，只实现 M1：桌面壳、类型化桥接、MockRepository 和基础导航。尚未安装应用依赖、尚未运行真实 Electron 应用、没有正式安装包。

## 已知限制

HTML 原型只模拟文件/Agent 行为；本地浏览器视觉复验受环境限制，已有脚本检查。图谱颜色与布局在生产代码中应数据驱动。启动包检查不等同于完整 JSON Schema 或应用测试；M1 加入 Ajv 等正式 schema 校验。

## 每阶段更新

记录阶段、分支、提交、运行命令与结果、未完成项、下轮入口。Git 实际接入信息见 REPOSITORY.md。
