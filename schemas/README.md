# 协议 schema

JSON Schema draft 2020-12，引用 project.schema.json 中的共享定义。example 域名仅作 schema 标识，不会联网；校验器必须预注册本地三份 schema。

语法校验不替代业务验证：路径 realpath 边界、文件指纹、ID 唯一、引用存在、同材料父节点、无环、任务输入一致性、事件幂等都须在主进程验证。M1 加入 Ajv 2020 与 date-time format 校验并对合成 fixture 执行正式 schema 校验。现有 npm run check 是轻量启动包检查，不实现整个 JSON Schema 标准。
