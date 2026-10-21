# 协议 schema

JSON Schema draft 2020-12，引用 project.schema.json 中的共享定义。example 域名仅作 schema 标识，不会联网；校验器必须预注册本地三份 schema。

语法校验不替代业务验证：路径 realpath 边界、文件指纹、ID 唯一、引用存在、同材料父节点、无环、任务输入一致性、事件幂等都须在主进程验证。M2 已加入 Ajv 2020 与 date-time format 校验并对合成 fixture 执行正式 schema 校验。当前 npm run check 包含 schema 校验相关测试及桌面工程检查，实际覆盖以测试文件为准。

当前正式协议仍为 schemaVersion=1、单文件版本。[多文件材料设计](../docs/10-material-bundles.md) 是 M3 的 v2 目标，本次仅更新设计文档。实现前同步三套 schema、fixture、领域类型、业务模板与迁移测试，不向 v1 项目写入未定义的成员字段。
