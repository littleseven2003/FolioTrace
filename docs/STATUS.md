# 开发状态

更新时间：2026-10-21

## 已完成 M0

产品与架构、交互原型、数据 schema 与合成 fixture、DSH 提示词、贡献与 Git 规范、启动包检查。原型品牌已更新为文脉 / FolioTrace。

## M1 已合并（2026-10-20）

- PR #2 已合并到 `main`（合并提交 `1a40fbc`），`main` 的 `Quality checks` / `starter-check` 通过。
- 用户反馈已在普通终端完成 `npm install && npm run dev` 启动测试（由用户执行；Agent 本轮未复跑普通终端，也不把该结果记作自动测试）。
- 品牌 Logo、模拟工作台、Result 契约与来源校验已进入 `main`；软件版本仍为 0.0.0，未打标签。
- 具体 M1 实现与验收记录保留在下方各小步章节。

## M1 进行中：第二步（模拟数据工作台）

已完成：

- 领域层 `src/domain/project.ts`：材料、版本、项目快照类型，以及按生成时间排序、最新版本、当前采用等纯函数选择器；不依赖 React、Electron 或文件系统。
- 独立模拟数据 `src/main/mocks/demo-project.ts` 与只读 `MockProjectRepository`；每次调用返回独立快照，调用方修改不会污染后续读取。
- 类型化 preload 新增 `window.folio.getProjectSnapshot()`；主进程校验 IPC sender 后返回项目快照，renderer 仍无法访问 Node、fs 或 shell。
- 工作台界面：左侧导航（产出材料 / 全部文件 / 项目总览 / 待处理）；产出材料页含三张材料卡、中间版本时间线、右侧版本详情。点击材料或版本，时间线与详情联动切换。
- 徽标语义：分别显示“最新生成”“当前采用”“待确认”“历史版本”。PPT 最新第三版明确不是当前采用（第二版）；详情提示“最新生成版本不会自动成为当前采用版本”。本轮采用状态只读，不提供切换按钮。
- 全部文件、项目总览、待处理显示明确的里程碑占位（M2 / M3 / M5）；加载、错误重试、空状态齐全；窄窗口改为上下布局。
- 质量门：ESLint 10 + typescript-eslint 8 + React Hooks 规则；Vitest 5 + jsdom 30 + Testing Library 16；12 个单元/交互测试。`npm run check` 汇总启动包检查、typecheck、lint、test、build 与提交标题自测；GitHub Actions 改用 `npm ci`。

### 实际运行结果

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：120 个文件启动包检查、typecheck、lint、29 个测试、生产构建、提交标题自测 |
| `npm run test` | 通过：6 个测试文件 / 29 个测试（领域 7 + IPC 15 + 工作台交互 7） |
| `npm run lint` | 通过（0 warning） |
| `npm run typecheck` | 通过（main/preload、renderer、tests 三套 tsconfig） |
| `npm run build` | 通过（`out/main`、`out/preload`、`out/renderer` 生成） |
| `npm run dev` | 1280×820 工作台窗口启动；CDP 确认材料切换、版本选择、占位页、只读采用提示，renderer 无 `require` / `process` / `ipcRenderer` |
| `npm start -- --skipBuild` | 生产构建预览窗口通过同一套 CDP 交互验收 |

本轮验证环境：macOS 26.6.2（arm64）、Node v26.0.0、npm 11.12.1、Electron 44.9.0（Node 24.22.0 / Chromium 152）、electron-vite 6.0.0、Vite 8.3.4、React 19.3.1、TypeScript 5.9.3、Vitest 5.0.5。工具链决策见 [ADR 0002](adr/0002-m1-toolchain.md)。

### 手工验收步骤

普通终端（不在 DSH 文件沙箱内）执行：

```sh
npm install
npm run dev
```

1. 窗口进入“产出材料”，默认选中“成果汇报 PPT”的第三版。
2. 时间线中第三版显示“最新生成 / 待确认”，第二版显示“当前采用”；右侧提示“当前采用：第二版”。
3. 点击“配套详细报告”：时间线与详情切换，第三版同时显示“最新生成 / 当前采用”。
4. 回到 PPT 并点击“第一版”：详情显示“历史版本”，当前采用仍为第二版。
5. 点击“全部文件 / 项目总览 / 待处理”：分别看到 M2 / M3 / M5 占位说明。
6. 确认没有“设为当前采用”等写操作（本轮只读）。

DSH 会话内 Chromium 嵌套沙箱无法初始化，验证时使用：

```sh
npm run dev -- --noSandbox -- --disable-gpu
```

该参数仅用于 DSH 环境，普通终端不要携带。

## M1 第三步（IPC 契约与来源校验，已完成）

- `getRuntimeInfo`、`getProjectSnapshot` 返回共享 `Result<T>`，错误码为 `INTERNAL_ERROR`、`UNTRUSTED_SOURCE`。读取失败显示固定中文消息并可重试；内部异常与堆栈只写主进程日志，不进入界面。
- IPC 仅接受当前主窗口的 main frame：同时校验 webContents id、frame process/routing id 与 frame URL，拒绝其他窗口、子框架和已关闭窗口。
- 生产只信任主进程实际加载的 `out/renderer/index.html`，不再放行任意 `file:` 页面；开发只信任 `ELECTRON_RENDERER_URL` 配置的开发服务器 origin。
- 导航层拒绝非可信主框架导航、服务端重定向、非主框架导航、新窗口与 webview 附加。
- 新增 15 个 IPC 测试（`ipc-trust` 9、`ipc-respond` 6），覆盖成功、仓库异常脱敏、其他窗口/子框架/非入口 URL 拒绝。

第三步验证结果：

| 检查 | 结果 |
| --- | --- |
| `npm run test` | 6 文件 / 29 测试通过 |
| `npm run check` | 通过：120 文件、typecheck、lint、29 测试、build、提交标题自测 |
| dev 窗口 CDP | 两个 API 均返回 `{ok:true,...}`；外部导航与 `window.open` 被拦截；renderer 无 `require` / `process` / `ipcRenderer` |
| 生产预览 CDP | file 入口下 API 正常，外部导航与弹窗被拦截 |

## M1 第四步（品牌接入与双环境验收，已完成）

- 工作台顶栏通过构建工具导入 `assets/brand/logo.svg`，替换“文”字占位；按 30×31 显示，旁边已有“文脉 / FolioTrace”名称，因此使用空 `alt` 与 `aria-hidden`，并补充集成测试。
- 自动检查：`npm run check` 通过（120 文件、typecheck、lint、29 测试、build、提交标题自测）。
- 窗口人工验收（dev 与生产预览各执行一次，CDP 辅助操作并截图，不是 CI 自动测试）：
  - Logo 实际加载：natural 146×150、显示约 30.08×31，比例正确，`alt=""`、`aria-hidden="true"`；
  - 材料切换与版本选择正常，历史版本、当前采用、最新生成徽标正确；
  - 通过临时替换主进程 handler 注入一次真实 IPC 失败：界面显示“项目快照加载失败 / 暂时无法读取项目快照，请稍后重试。”，无内部堆栈；恢复 handler 后点击“重新加载”恢复工作台；
  - 最新生成的第三版仍未自动成为当前采用（第二版）。
- 说明：错误注入仅用于验收，未写入应用代码；应用本身没有模拟失败开关。

## M2 进行中：第一小步（目录选择、只读扫描、全部文件）

已完成：

- 原生目录选择：主进程 `dialog.showOpenDialog` 选择文件夹；取消是正常结果（`{canceled:true}`），不显示错误。
- 会话内目录授权：主进程保存 canonical 根路径并签发 `project-<uuid>` handle；扫描与后续操作只接受 handle，renderer 不接收/传递绝对路径。
- 只读扫描：`files:scan` 返回相对路径、类型、大小、修改时间，全部文件初始分类为 `unclassified`（未分类），不会自动加入参考资料。
- 安全边界：忽略 `.git`、`.docwork`、`node_modules` 等内部目录；跳过所有符号链接；目录用 realpath 再校验根内；权限不足、目录不可读、扫描期间文件消失记录为警告而不中断。
- 目录替换竞态修复：授权时记录根目录 dev/ino；扫描开始、目录 readdir 前后、文件元数据读取前后反复校验 realpath 与目录身份；检测到替换即终止整次扫描，返回 `SCAN_ABORTED` 并丢弃全部文件结果，避免把根外文件混入清单。
- 全部文件页：真实目录模式与模拟演示明确分离；支持手动重新扫描、扫描警告展示、错误重试；接入真实目录后顶栏/侧栏切换为“本地目录 · 只读”，产出材料/总览/待处理显示真实模式占位，不混入模拟数据。
- 只读保证：不创建/修改业务文件、`project.json` 或 `AGENTS.md`，不实现文件分类写回、版本登记或图谱。

### 自动检查

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：131 个文件启动包检查、typecheck、lint、47 个测试、生产构建、提交标题自测 |
| `npm run test` | 通过：9 个测试文件 / 47 个测试 |

### 扫描替换竞态修复（2026-10-20）

- 复现问题：子目录在 realpath 校验后、递归 readdir 前被替换为指向根外的符号链接，旧实现仍按路径读取，会把根外文件列为项目文件且无警告。
- 修复策略：授权时记录根目录 `dev/ino`；扫描开始比对同一身份；每个目录 readdir 前后、每个文件 lstat 前后都复核 realpath 与目录身份；任一不一致即整次扫描终止，返回 `SCAN_ABORTED`，`files` 为空。
- 确定性回归测试覆盖：子目录替换、祖先目录替换导致子路径解析到根外、根目录替换、文件元数据读取期间父目录身份变化。
- 当前平台保证范围：macOS 已验证；Node 没有可用的 openat/fd-relative 元数据接口，无法消除“在单次系统调用边界内瞬时替换并恢复”的极端竞态。当前策略是检测到持久替换即失效关闭，文件内容从不读取；其他平台未验证。

### 窗口验收（Agent 执行，非用户验收）

- 使用临时合成目录，并通过主进程 inspector 临时替换 `dialog.showOpenDialog` 返回值来驱动真实窗口（未人工点击原生对话框）。
- 取消路径：显示“已取消选择文件夹。”，不触发扫描。
- 扫描路径：仅列出 2 个真实文件；`.git`、`.docwork`、`node_modules` 与符号链接（含根外目标）未出现；`restricted` 目录产生“没有读取权限，已跳过。”警告；相对路径、类型、大小、修改时间与“未分类”显示正确；手动重新扫描仍为 2 个文件。
- 真实模式：顶栏显示“本地目录 · 只读”；产出材料页显示 M3 占位，不显示模拟材料时间线。
- 只读证明：扫描前后业务文件 SHA-256 清单一致；fixture 预置的 `.docwork/project.json` 未被修改；未创建新的 `project.json` 或 `AGENTS.md`；根外 symlink 目标未变。
- 说明：原生系统对话框的人工点击仍未由 Agent 执行；取消与成功路径通过 stub + 自动化测试覆盖。

## M2 第二步（项目元数据初始化与重新读取，已完成）

- 打开文件夹仍默认只读；只有用户点击“初始化文脉项目”后才创建 `.docwork/project.json`。
- 初始化使用现有 `schemas/project.schema.json`（未修改协议）：`schemaVersion=1`、`revision=1`，files/documents/versions/relations/tasks/importedEvents 均为空；扫描结果不会自动成为参考资料。
- 已有 project.json 由 Ajv 2020 + date-time format 按 schema 校验后读取，保留原有 ID、分类与其他数据；损坏或不支持的高版本只提示，不覆盖重建。
- 存储层：同目录临时文件写入 + fsync + rename 原子提交；`.docwork/project.lock` 单写者锁（同主机死进程可回收）；`writeProject` 校验 expectedRevision 与 revision+1，冲突返回 `REVISION_CONFLICT`；拒绝 `.docwork` 或 `project.json` 被符号链接重定向。
- 重新选择同一文件夹（包括退出重启后）可读取原项目 revision 与 ID；自动恢复最近项目不在本轮。
- 新增 21 个元数据/存储/schema/交互测试（总计 68 个测试）。

### 自动检查

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：136 个文件启动包检查、typecheck、lint、68 个测试、生产构建、提交标题自测 |
| `npm run test` | 通过：11 个测试文件 / 68 个测试 |

### 窗口验收（Agent 执行，非用户验收）

- 临时合成目录 + 主进程 inspector 替换目录选择器；打开文件夹后确认 `.docwork` 不存在，界面显示“尚未初始化文脉项目”。
- 点击“初始化文脉项目”后生成 `.docwork/project.json`：schemaVersion 1、revision 1、六个集合为空；界面显示“已初始化 / revision 1”。
- 重启应用并重新选择同一临时目录：读取 revision 1，不再显示初始化按钮。
- 业务原文件 SHA-256 前后一致；`.docwork` 下仅新增 project.json，未创建或改写 AGENTS.md。
- 说明：窗口验收使用 stub 驱动，原生目录选择器人工点击未由 Agent 执行；损坏数据、锁、写入失败、revision 冲突由自动化测试覆盖。

### 授权根身份修复（2026-10-21）

- 复现：授权根目录 → 将根目录移走 → 原路径建立指向根外的符号链接 → 初始化。旧实现虽返回 `PATH_OUTSIDE_ROOT`，但已在根外创建 `.docwork`。
- 根因：元数据存储只接收 `rootPath` 字符串，且在 mkdir/锁/临时文件前未复核授权时记录的根身份。
- 修复：`ProjectMetadataStore` 所有读取、初始化、更新都接收 `AuthorizedRoot`（canonical 路径 + 授权时 dev/ino）；读取、mkdir、lockfile、临时文件、rename 前逐点复核根身份；根被换成符号链接、另一个普通目录或祖先被替换时返回 `ROOT_IDENTITY_MISMATCH`，拒绝前不创建/修改/删除任何内容；陈旧锁回收与失败清理也先复核。
- 回归测试：根目录被替换为根外符号链接、根目录换成另一普通目录、祖先目录被替换；均比较根外目录与迁移前目录的完整内容哈希，并断言未创建 `.docwork`。
- 窗口复现（Agent 执行）：真实 dev 窗口中完成上述“移走根目录 + 根外符号链接”后点击初始化，界面显示“项目根目录已变化，请重新选择文件夹。”；根外目录内容前后一致，迁移前目录也未出现 `.docwork`。
- 剩余限制：仍是路径级“检查 → 系统调用”模式，无法完全消除单次系统调用边界内的瞬时替换竞态；其他平台未验证。

### 扫描 IPC 参数回归修复（2026-10-21）

- 复现：打开真实文件夹后，首次扫描与重新扫描均失败，界面同时出现“项目根目录已变化…”与“项目授权已失效…”；`files:scan` 返回 `PROJECT_NOT_FOUND`。
- 根因：`filesScan` handler 先用 handle 解析出授权根路径，再把 `rootCheck.value.rootPath` 传给 `scanAuthorizedProject`；而该服务的第一个参数是 handle，内部会再执行 `registry.resolve(handle)`，绝对路径必然解析失败。
- 修复：handler 直接把 `validateHandle` 后的 handle 交给 `scanAuthorizedProject`，根路径只由主进程授权表解析；`project:getMetadata` 与 `project:initialize` 仍走 `resolveAuthorizedProject`，保留授权根身份校验。
- 新增 5 个 handler 层回归测试（`tests/unit/ipc-handlers.test.ts`）：只替换 Electron 运行时，使用真实 `ProjectRegistry`、`ProjectMetadataStore` 与真实临时目录；覆盖已授权 handle 经 `files:scan` 返回真实相对文件、未知 handle 与绝对路径均返回 `PROJECT_NOT_FOUND`、其他窗口/子框架/非入口 URL 返回 `UNTRUSTED_SOURCE`、授权根被替换后 `project:initialize` 仍返回 `ROOT_IDENTITY_MISMATCH`。移除修复后，该文件有 2 个测试失败，确认测试能捕获此回归。
- 总计：12 个测试文件 / 73 个测试。

### 自动检查

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：137 个文件启动包检查、typecheck、lint、73 个测试、生产构建、提交标题自测 |
| `npm run test` | 通过：12 个测试文件 / 73 个测试 |

### 窗口验收（Agent 执行，非用户验收）

- 真实 dev 窗口 + 主进程 inspector 替换目录选择器为合成临时目录（含 `report.docx`、`notes/plan.md`、`.git/config`），完成选择目录、首次扫描、重新扫描与项目初始化。
- 首次扫描：显示“共 2 个文件”，清单为 `notes/plan.md`、`report.docx`；`.git` 内容未出现；无错误提示或警告。
- 重新扫描：先在目录中新增 `rescan-note.md`，点击“重新扫描”后显示“共 3 个文件”并列出新文件，证明重新经过扫描 IPC 而非复用旧结果；仍无授权失效或根目录变化提示。
- 项目初始化：点击“初始化文脉项目”后显示“文脉项目已初始化（revision 1）。”，元数据面板显示“已初始化 / revision 1”，初始化按钮消失；磁盘 `.docwork/project.json` 为 schemaVersion 1、revision 1、六个集合为空。
- 说明：原生目录选择器的人工点击仍未由 Agent 执行；本次仍以 stub 驱动。

### 文件用途分类与持久化（2026-10-21）

- 已初始化项目可在“全部文件”逐项设置用途：参考资料 / 过程文件 / 产出材料 / 排除 / 未分类；未初始化时仍只读，不显示用途控件。
- 新增 `files:classify` IPC：主进程校验调用来源、handle、relativePath、role 与 expectedRevision；拒绝绝对路径、`..`、反斜杠、`.docwork`/`.git` 等内部目录、目录与符号链接。
- 首次登记生成 `file-<uuid>` 稳定 ID，并读取文件内容计算真实 SHA-256；只读取内容计算指纹，不存储内容、不修改业务文件。已登记文件只更新 role，保留 ID、原 SHA-256 以及 documents/versions/relations/tasks/importedEvents 等其他数据。
- 内容变化时保留记录中的原指纹并返回 `contentChanged`，界面提示“文件内容已变化，保留上次登记的指纹”，不静默改写指纹，也不自动登记新版本。
- 持久化复用 `ProjectMetadataStore.writeProject`：lockfile 单写者、expectedRevision 校验、同目录临时文件 fsync + rename 原子提交；revision 过期返回 `REVISION_CONFLICT`，界面提示重新读取，不覆盖。
- 新增 9 个服务测试、4 个 IPC handler 测试、5 个交互测试（总计 91 个测试）。

### 自动检查

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：139 个文件启动包检查、typecheck、lint、91 个测试、生产构建、提交标题自测 |
| `npm run test` | 通过：13 个测试文件 / 91 个测试 |

### 窗口验收（Agent 执行，非用户验收）

- 真实 dev 窗口 + 主进程 inspector 替换目录选择器为合成临时目录（含 `report.docx`、`notes/plan.md`、`draft.md`）。
- 初始化后把 `report.docx` 设为“产出材料”：`project.json` revision 2、文件记录 1、ID 为 `file-<uuid>`、SHA-256 与 `shasum -a 256` 结果一致；其余文件保持未分类。
- 重新扫描后用途仍在；退出并重启应用后重新打开同一文件夹，用途恢复为“产出材料”。
- 冲突：外部把 `project.json` revision 从 2 改为 3 后再次修改用途，界面提示“项目数据已被其他操作更新，请重新读取后再试。”，原用途与磁盘 revision 3 均未被覆盖；点击“重新读取元数据”后再次保存成功（revision 4），ID 与 SHA-256 保持不变。
- 说明：原生目录选择器的人工点击仍未由 Agent 执行；本次仍以 stub 驱动。

## 下一步（M2 剩余）

- 批量指定用途、文件重命名后的记录迁移，以及内容漂移后的重新登记流程。
- 自动恢复最近项目（当前需重新选择同一文件夹）。
- 产出材料、项目总览、待处理在真实模式下仍为占位，等待 M3 / M5。
- 生产 CSP、受控应用协议、打包签名与安装包尚未实现。
- Playwright 桌面自动化与 CI 中的窗口级验收待补。

## 已知限制

- 模拟数据只读，不读取或写入用户业务文件夹；快照 `revision=7` 只是模拟版本号。
- DSH 会话内需 `--noSandbox` 才能启动 Electron，普通终端是否无参数启动仍需人工验收。
- 工作台目前只覆盖单项目、产出材料纵向切片；真实模式的文件/图谱/待处理内容与交互尚未实现。
- 原生目录选择器的系统对话框人工点击未在 Agent 验收中执行；窗口验收通过 stub 覆盖取消/成功路径。
- 扫描器对路径替换采用失效关闭策略，但受 Node/Electron 缺少 openat 类 API 限制，无法完全排除单次系统调用边界内的瞬时替换竞态；其他平台未验证。
- 文件用途按相对路径匹配并逐项保存；重命名后旧记录保留、新路径按新文件登记，不自动迁移；批量操作尚未实现。
- 首次登记会流式读取文件内容计算 SHA-256（不保存内容）；内容漂移当前只提示并保留旧指纹，重新登记新版本留给版本登记阶段；自动恢复最近项目尚未实现，重启后需重新选择同一文件夹读取 project.json。
- 元数据存储对管理目录/目标文件与授权根身份做静态拒绝与写前复核，但同样受 Node 缺少 openat 类 API 限制；锁文件只在同主机、同 PID 校验下回收陈旧锁，不支持网络共享目录并发。
- 生产入口当前按 `file:` 路径精确比较；未来改用受控 `app://` 协议时需同步更新来源校验与测试。
- IPC 来源校验依赖 Electron frame process/routing id；目前只在 macOS 验证，未做其他平台手工复验。
- 启动包检查不等同于完整 JSON Schema 或桌面应用 E2E；导入事务与崩溃恢复在 M5 补齐。
- 当前 package 0.0.0、schemaVersion 1，未升版本、未打标签。

## 每阶段更新

本轮分支 `feat/m2-project-files`，小步提交：`5b2f7a1`（M1 合并与 M2 交接）、`d3bdcc5`（只读扫描与目录授权）、`9a5e7dc`（目录选择与扫描 IPC）、`8f6c591`（全部文件真实列表）、`e3320a7`（扫描目录替换竞态修复）、`e2cbeae`（元数据校验与原子存储）、`c39e52d`（元数据 IPC）、`90fe017`（初始化入口界面）、`e1ded64`（授权根身份复核）、`4d74104`（扫描 IPC handle 参数修复）、`e522d38`（文件用途分类服务与 IPC）、`29e6c39`（全部文件页用途保存与恢复），以及文档提交。M1 分支 `feat/m1-shell` 已合并（`1a40fbc`）。Git 实际接入信息见 REPOSITORY.md。

## 提交与版本规则更新

已要求每个完成并验证的小改动立即独立 commit，格式为英文类型＋中文全角冒号＋中文描述；新增 docs/09-versioning.md。当前 package 0.0.0、schemaVersion 1 保持不变，尚未发布任何桌面版本。

提交格式现有本地 hook 与 CI 检查；克隆后按启动指南启用 hook。版本规范没有触发应用发布。

## 品牌资源（2026-10-20）

用户选择 A「文稿留痕」方向。品牌母版与导出位于 [assets/brand](../assets/brand/README.md)，包含彩色 / 单色 / 反白 SVG、横向组合、七档应用图标 PNG 和原始概念参考。README 已展示新标志。

这是品牌资源交付。工作台顶部已接入 `logo.svg`；HTML 原型、Electron 窗口/安装包图标尚未接入，打包阶段再补 ICNS / ICO 与 Electron 配置。软件版本 0.0.0、协议版本 1 不变。

本轮检查：`npm run check` 通过（品牌资源提交时为 115 个文件、类型检查、lint、12 个测试、生产构建、提交标题自测）；5 个 SVG 母版通过 XML / viewBox 检查；10 个 PNG 已核对尺寸，透明 Logo 的 alpha 保留，资源预览已目视核对。
