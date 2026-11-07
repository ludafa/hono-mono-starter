# 构建与依赖：施工计划

> 相关：[模块说明](README.md) · [技术实现](tech.md) · [可行性调研：TypeScript 7](probe-typescript-7.md) · [验证方案](verification.md)

## 2026-07-19（分支 `chore/vite8-migration`，PR #1）

起因：用户要求把 Vite / rolldown 工具链升到最新。

### 阶段 1：先升到 rolldown-vite@7.3.1

- 状态：✅ 完成（2026-07-19），随后被阶段 2 取代。
- 实际改动：最保守的一步，只升 `rolldown-vite` 的小版本。用户看过结果后明确选择完整迁到 Vite 8（用户拍板）。

### 阶段 2：迁到 Vite 8，pnpm 配置搬家

- 文件：`apps/client/package.json`（vite 和相关插件）、`pnpm-workspace.yaml`（删掉 `vite` override，加 `allowBuilds`）、根 `package.json`（删掉失效的 `pnpm` 字段）、CLAUDE.md、README、`pnpm-lock.yaml`。
- 状态：✅ 完成（2026-07-19，提交 `ebcb9b2`，PR #1 合入）
- 实际改动：升级表见 [tech.md §1.2](tech.md#12-一起升级的包)。`vite.config.ts` 只有格式变化。同一个提交也升级了 server 的依赖（`hono` 4.12.31、`@hono/zod-openapi` 1.5.1、`better-auth` 1.6.23 等）。
- 检查：见 [verification.md §4](verification.md#4-各次实际结果)。

## 2026-07-25（分支 `chore/vite8-migration`，PR #2）

- client 依赖例行小升级（提交 `d98b5a5`）：react / react-dom 19.2.5 → 19.2.8、kubb 4.37 → 4.39、better-auth 1.6.9 → 1.6.25、`@types/node` 25 → 26，以及 base-ui、tanstack、lucide、shadcn 的小版本。
- `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 加 `eslint@10.8.0`，免得被 pnpm 的发布时间限制拦下。
- 同一个 PR 里还有提交流程的改动，见 [提交流程的施工计划](../commit-workflow/plan.md)。

## 2026-10-21（分支 `ludafa/add-oxlint-eslint-config`）

### 阶段 1：TypeScript 7 可行性调研

- 状态：✅ 完成（2026-10-21）
- 实际改动：在仓库副本里试装 TS 7 跑全流程，结论和数据见 [probe-typescript-7.md](probe-typescript-7.md)。没有升级。
- 偏差：调研中发现 Kubb 生成的代码不再被格式化，在 [lint-format 施工计划阶段 3](../lint-format/plan.md#阶段-3kubb-生成代码没有格式化claude-发现计划外) 里修了。

### 阶段 2：去掉 eslint 的发布时间豁免

- 状态：✅ 完成（2026-10-21）
- 实际改动：ESLint 被 Oxlint 替换后，`pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 删掉 `eslint@10.8.0`，见 [lint-format 施工计划阶段 1](../lint-format/plan.md#阶段-1选型用-oxlint--oxfmt-替换-eslint--prettier)。

## 2026-11-04（分支 `build/kubb-5`）

起因：要支持返回 SSE 的接口，用户要求把 Kubb 升到 5 的最新版（用户拍板）。

### 阶段 0：预研

- 状态：✅ 完成（2026-11-04）
- 实际改动：读了 v5 各包随 npm 发布的 `docs/`。结论：SSE 支持在 `@kubb/plugin-fetch` 里；v5 的 `@kubb/plugin-client` 不再自带 client；`@kubb/plugin-oas` 换成默认启用的 `@kubb/adapter-oas`；`@kubb/cli` + `@kubb/core` 合进总包 `kubb`。选型见 [tech.md §5.1](tech.md#51-起因和选型)。

### 阶段 1：换包、改配置、重新生成

- 文件：`apps/client/package.json`、`pnpm-lock.yaml`、`apps/client/kubb.config.ts`、`apps/client/src/gen/**`（重新生成）。
- 状态：✅ 完成（2026-11-04）
- 实际改动：包和配置见 [tech.md §5.2](tech.md#52-包的变化)、[§5.3](tech.md#53-配置)。`pnpm add` 没被发布时间限制拦下，不用加 `minimumReleaseAgeExclude`。
- 检查：`generate:api` 通过（19 个文件，约 0.15 秒，实测）。

### 阶段 2：调用方改成 v5 的写法

- 文件：`apps/client/src/lib/api.ts`、`apps/client/src/pages/dashboard.tsx`。
- 状态：✅ 完成（2026-11-04）
- 实际改动：`api.ts` 改用 `client.setConfig`；`postApiNotes` 的参数包进 `body`。见 [tech.md §5.4](tech.md#54-生成物和调用方式的变化)。
- 检查：client `tsc -b`、`vite build` 通过；浏览器里新建和列出 note 正常（[verification.md §4](verification.md#4-各次实际结果)）。

### 阶段 3：验证 SSE

- 状态：✅ 完成（2026-11-04）
- 实际改动：在 server 写了一个临时的 `/api/ticks`（`createRoute` + `streamSSE`），导出 spec，用和正式配置一样的插件生成到临时目录，再用生成的函数连真实 server 读事件流。临时文件全部删掉，没有提交。写法整理进 [tech.md §5.5](tech.md#55-sse-接口怎么写)。
- 检查：见 [verification.md §4](verification.md#4-各次实际结果)。

### 阶段 4：文档

- 文件：本模块的 `README.md` / `tech.md` / `plan.md` / `verification.md`；[lint-format tech.md §5](../lint-format/tech.md#5-生成文件2026-10-212026-11-04-修订)（v5 的 `output.lint` 默认值）；`.claude/skills/regen-api-client/SKILL.md`（生成物说明）。
- 状态：✅ 完成（2026-11-04）

## 2026-11-07（分支 `build/kubb-5`）

起因：用户问仓库里有没有 SSE 的示例，要一个能跑的（用户追加）。

### 阶段 1：server 示例接口

- 文件：`apps/server/src/routes/ticks.ts`（新）、`apps/server/src/app.ts`、`apps/server/openapi.yml`（重新生成）。
- 状态：✅ 完成（2026-11-07）
- 实际改动：`GET /api/ticks`，见 [tech.md §5.6](tech.md#56-示例get-apiticks2026-11-07)。
- 检查：server `tsc --noEmit` 通过；curl 实测见 [verification.md §4](verification.md#4-各次实际结果)。
- 偏差：`after` 最初写成 `min(0).default(0)`，spec 里成了 `integer | null`；改用 `.openapi({ type: 'integer' })` 会覆盖掉整个 schema（`minimum`、`default` 都没了）；最后改成 `min(1)` 的可选参数。

### 阶段 2：client 演示卡片

- 文件：`apps/client/src/gen/**`（重新生成）、`apps/client/src/components/tick-stream.tsx`（新）、`apps/client/src/pages/dashboard.tsx`、根 `README.md`（目录说明）。
- 状态：✅ 完成（2026-11-07）
- 检查：client `tsc -b` 通过；浏览器里 Start / Stop / Resume 都正常。

### 阶段 3：断线行为实测，加空闲超时（Claude 发现，计划外）

- 现象：经过 Vite dev 代理时，流到一半杀掉 server 进程，页面一直停在 `streaming`，30 秒后还是这样。
- 原因：代理没有把上游断开传给浏览器；`for await` 既不结束也不抛错。直连时浏览器会立刻抛 `TypeError: network error`。
- 实际改动：`TickStream` 加 3 秒空闲超时（`IDLE_TIMEOUT_MS`），超时用 `controller.abort(IDLE)` 中止，按 `signal.reason` 显示成 `dropped`；[tech.md §5.5](tech.md#55-sse-接口怎么写) 改写断线一节。
- 检查：杀掉 server 约 3 秒后页面变成 `dropped`；重启 server 后点 Resume，从断开的下一条接着收到 done。

### 阶段 4：文档

- 文件：本模块的 `README.md` / `tech.md`（§4 风险表两行、§5.5 修订、§5.6 新增）/ `plan.md` / `verification.md`。
- 状态：✅ 完成（2026-11-07）

### 阶段 5：code review 修复（用户要求，计划外）

- 起因：`/code-review high` 报了 10 条，用户要求全部修（用户拍板）。
- 文件：`apps/server/src/middleware/auth.ts`（导出 `AuthEnv`）、`apps/server/src/routes/ticks.ts`、`apps/server/src/routes/example.ts`、`apps/server/openapi.yml` 和 `apps/client/src/gen/**`（重新生成）、`apps/client/src/lib/api.ts`、`apps/client/src/components/tick-stream.tsx`、`apps/client/src/pages/dashboard.tsx`、`apps/client/package.json`、`.claude/skills/add-api-endpoint/SKILL.md`。
- 状态：✅ 完成（2026-11-07）
- 实际改动：

| #   | 问题                                                                    | 改动                                                                                       |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | 新建笔记失败时页面上什么都没有：v5 遇到非 2xx 抛错，`handleCreate` 没接 | dashboard 接住加载和新建的错误并显示（[tech.md §5.7](tech.md#57-非-2xx-的处理2026-11-07)） |
| 2   | 只有 `retry:` 的事件 `data` 是 `undefined`，`event.data.type` 会抛错    | 先用 `tickEventSchema.safeParse` 校验，不合格的跳过（tech.md §5.5）                        |
| 3   | SSE 接口出错时 `err.data` 是没读的流，拿不到 `ApiError`                 | `errorMessage` 把流读成 JSON 再取 `error`（tech.md §5.7）                                  |
| 4   | client 没有 `typecheck` 脚本，`pnpm typecheck` 只查 server              | 加 `"typecheck": "tsc -b"`（tech.md §6）                                                   |
| 5   | 空闲计时器在请求发出前就开始，首次响应慢于 3 秒会被当成断线             | 拿到 stream 之后才算空闲超时，连接阶段 10 秒超时（tech.md §5.6）                           |
| 6   | client 写死总数 `TOTAL = 10`                                            | 从最后一个 tick 的 `total` 读                                                              |
| 7   | `lastId` 和最后一个 tick 的 `n` 是同一个值，存了两份                    | 删掉 `lastId`                                                                              |
| 8   | `type AuthEnv` 抄了三份                                                 | 从 `middleware/auth.ts` 导出，两个路由文件引用它                                           |
| 9   | 直接从 `src/gen/.kubb/client` 导入                                      | 改从 `@/gen` 导入                                                                          |
| 10  | `/api/ticks` 的 400 没声明，body 也不是 `ApiError`                      | 声明 `400: ApiError`，`defaultHook` 把校验错误转成 `ApiError`（tech.md §5.7）              |

- 检查：`pnpm lint`、`pnpm typecheck`（现在包括 client）通过；curl 和浏览器的结果见 [verification.md §4](verification.md#4-各次实际结果)。
- 偏差：第 10 条我原来建议不改，因为 notes 路由也没声明 400；用户要求一起修，范围只限 `ticksApp`，notes 路由记进 tech.md §4 风险表。第 2、3 条用了生成的 zod schema，zod 进了 client 打包结果，gzip 后多约 18 kB（tech.md §5.7）。
- 文档：tech.md §4 风险表加一行，§5.3 至 §5.6 修订，新增 §5.7、§6；本模块 `README.md`、`verification.md`。
