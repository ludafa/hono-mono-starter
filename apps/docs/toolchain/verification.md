# 构建与依赖：验证方案

> 相关：[模块说明](README.md) · [技术实现](tech.md) · [可行性调研：TypeScript 7](probe-typescript-7.md) · [施工计划](plan.md)

## 1. 自动测试

本模块没有单测，靠类型检查和构建兜底（§2）。

## 2. 端到端检查

| 检查                                                          | 预期                                                                                                                            | 日期       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `pnpm --filter @hono-mono-starter/client exec vite --version` | `vite/8.x`                                                                                                                      | 2026-07-19 |
| `pnpm --filter @hono-mono-starter/client why vite`            | 只有一个 vite 版本（server 的 vitest 也共用它）                                                                                 | 2026-07-19 |
| `pnpm --filter @hono-mono-starter/client build`               | `tsc -b && vite build` 都通过                                                                                                   | 2026-07-19 |
| `pnpm --filter @hono-mono-starter/client dev`                 | 打印 `VITE v8.x ready`，根路径和模块请求都返回 200                                                                              | 2026-07-19 |
| `CI=true pnpm install --frozen-lockfile`                      | 不报构建脚本被拦，lockfile 一致                                                                                                 | 2026-07-19 |
| `pnpm typecheck`                                              | server 的 `tsc --noEmit` 和 client 的 `tsc -b` 都跑，都通过                                                                     | 2026-11-07 |
| `pnpm --filter @hono-mono-starter/client generate:api`        | Kubb 5 生成通过，`src/gen/` 和已提交的版本没有 diff                                                                             | 2026-11-04 |
| 登录后 `curl -N -b <cookie> localhost:3000/api/ticks?count=3` | 3 条 tick 每 0.5 秒一条，最后一条 `{"type":"done"}`；不带 cookie 返回 401；`count=100` 返回 400 `{"error":"count: Too big: …"}` | 2026-11-07 |

## 3. 手动验收清单

1. `pnpm dev:server` 和 `pnpm dev:client` 都起来后打开 `http://localhost:5173/` → 登录页正常渲染，样式生效（Tailwind 在工作）。
2. 新建或改一个 `apps/client/src/routes/` 下的路由文件 → dev server 自动重写 `routeTree.gen.ts`。
3. 删掉 `node_modules` 后 `pnpm install` → `better-sqlite3` 等四个依赖的构建脚本正常执行，没有被拦下的提示。
4. 登录后打开 dashboard，新建一条 note → 列表里出现；刷新后还在（`getApiNotes`、`postApiNotes` 走 Kubb 生成的 client）。清掉 cookie 后再新建 → 表单里显示 `Unauthorized`，标题和正文保留，控制台没有未处理的 rejection。
5. dashboard 右栏 "Live stream" 点 Start → #1 到 #10 每 0.5 秒出现一条，最后状态 `done`。中途点 Stop → 状态 `stopped`，出现 "Resume from #N"；点它 → 从第 N 条接着收到 done。
6. 收流时停掉 `pnpm dev:server` → 约 3 秒后状态变成 `dropped`，提示 "No event for 3s."；重新起 server 后点 Resume → 接着收到 done。
7. 清掉 cookie 后在 "Live stream" 点 Start → 状态 `error`，显示 `Unauthorized`（从 SSE 接口的错误 body 读出来的）。
8. `kill -STOP $(lsof -ti tcp:3000 -sTCP:LISTEN)` 冻住 server 后点 Start → 4 秒时还是 `streaming`，10 秒变成 `dropped`，提示 "No response in 10s."；收流时冻住 → 最后一条之后约 3 秒变成 `dropped`。`kill -CONT` 后点 Resume → 接着收到 done。
9. 拦掉 `/api/notes` 的请求（agent-browser `network route "**/api/notes" --abort`）后刷新 → 列表位置显示 "Couldn’t load notes." 和 `TypeError: Failed to fetch`。

## 4. 各次实际结果

### 2026-07-19

- `vite --version` → `vite/8.1.5`；`why vite` → "Found 1 version of vite"；client `build` 通过；client `lint` 通过（当时是 ESLint，0 warning）；`dev` → `VITE v8.1.5 ready`，根路径和模块请求都是 200。
- 手动验收：当时没有单独记录。

### 2026-10-21

- 工作区仍是 TS 6：`pnpm typecheck`、client `build` 通过。TS 7 副本里的结果见 [probe-typescript-7.md §1](probe-typescript-7.md#1-结论)。

### 2026-11-04

- `generate:api`（Kubb 5.15.3）：19 个文件，约 0.15 秒（实测，Node 26.12.1）。重新生成后 oxfmt 已格式化，`src/gen/.kubb/` 也在内。
- client `tsc -b`、`vite build` 通过；`pnpm lint` 通过；`pnpm typecheck`（只跑 server）通过。
- `pnpm peers check` 报 `@types/react-dom@19.3.0` 要 `@types/react@^19.3.0`，main 上就有，和这次升级无关。
- 浏览器验收（agent-browser，临时环境变量起 server 和 client，数据库放在临时目录，开 `DEV_AUTO_LOGIN`）：dashboard 自动登录；新建 note → `POST /api/notes` 201，列表出现；刷新 → `GET /api/notes` 200，note 还在；控制台没有报错。
- SSE（临时接口，见 [plan.md 阶段 3](plan.md#阶段-3验证-sse)）：生成的函数返回 `Promise<EventStreamResult<Tick>>`，`event.data` 的类型是 `Tick`（`tsc` 通过）；连真实 server 读到 3 个事件，`event` / `id` / `data` 都对，响应头 `text/event-stream`；`AbortController` 在第 2 个事件后中止，`for await` 抛 `AbortError`。直连 server 测的，没有经过 Vite 代理。

### 2026-11-07

- curl（直连 server）：不带 cookie → 401 `{"error":"Unauthorized"}`；登录后 `count=3` → 3 条 tick 分别在 0 / 0.5 / 1.0 秒到达，接着 done；`count=5&after=3` → 只发 4、5 和 done；`count=0` → 400（zod 校验错误）。
- 经过 Vite 代理（页面里直接 `fetch('/api/ticks?count=4')` 读 body）：数据块在 4 / 505 / 1005 / 1507 毫秒到达，没有被缓冲。
- 浏览器（agent-browser，临时环境变量起 server 和 client）：Start → 逐条出现；Stop → `stopped`；Resume → 请求 `count=10&after=3`，接着收到 #4 到 #10，状态 `done`。第一次请求的 URL 是 `count=10`，`after: undefined` 没有被发出去。
- 断线：经过代理时杀掉 server，加超时之前页面停在 `streaming` 超过 30 秒；页面直连 `localhost:3901` 时立刻抛 `TypeError: network error`。加超时之后约 3 秒变成 `dropped`，重启 server 后 Resume 能接着收完。
- Vite 第一次加载新组件时预构建了 `@base-ui/react` 的两个模块（`Badge` 用到），整页刷新了一次，之后正常。
- `pnpm lint`、`pnpm typecheck`、client `tsc -b` 和 `vite build` 都通过；重新跑 `generate:openapi` 和 `generate:api` 没有新的 diff。
- code review 修复后（[plan.md 阶段 5](plan.md#阶段-5code-review-修复用户要求计划外)）：
  - curl（直连 server）：`count=100` → 400 `{"error":"count: Too big: expected number to be <=50"}`；`count=0&after=0` → 400，两个参数都列出来；`count=abc` → 400；不带 cookie 时 `count=100` → 401（`requireAuth` 在校验之前）；`count=2&after=1` → 只发 #2 和 done。`POST /api/notes` 发空标题仍是 zod-openapi 默认的 `ZodError` 形式，这次没改。
  - 脚本：把 `retry: 3000`、`data: not json`、一条 tick、一条 done 喂给 `parseEventStream`，前两条的 `data` 分别是 `undefined` 和 `"not json"`，`tickEventSchema.safeParse` 都不通过，被跳过；后两条正常。
  - 浏览器（agent-browser，经过 Vite 代理，开 `DEV_AUTO_LOGIN`）：Restart → 1.3 秒时 Stop → `stopped`，停在 #3，出现 "Resume from #4"；点它 → 收到 #10，`done`。清掉 cookie → Start 显示 `error` 和 `Unauthorized`，新建 note 在表单里显示 `Unauthorized`，标题保留，控制台没有报错。拦掉 `/api/notes` 后刷新 → "Couldn’t load notes." 和 `TypeError: Failed to fetch`。
  - 超时：`kill -STOP` 冻住 server 后 Start → 4 秒时还是 `streaming`，10.02 秒变成 `dropped` "No response in 10s."；收到 #4 后冻住 → 4.5 秒时 `dropped` "No event for 3s."，出现 "Resume from #5"；`kill -CONT` 后 Resume → 收完，`done`。
  - zod 第一次被 client 用到，Vite 预构建 zod 后整页刷新了一次，之后正常。
  - client `vite build` 主 chunk 454.43 kB（gzip 144.51 kB），改之前 387.62 kB（gzip 126.83 kB）。
  - `pnpm typecheck` 约 1.9 秒，两个包都跑；故意写错一处类型 → 报 `TS2322`，退出非 0。`pnpm lint` 通过。
