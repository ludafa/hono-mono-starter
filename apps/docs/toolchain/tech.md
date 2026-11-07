# 构建与依赖：技术实现

> 相关：[模块说明](README.md) · [可行性调研：TypeScript 7](probe-typescript-7.md) · [施工计划](plan.md) · [验证方案](verification.md)

## 1. Vite 8（2026-07-19）

### 1.1 选型

背景：client 当时靠 devDependency 别名 `"vite": "npm:rolldown-vite@7.2.5"` 用上 Rolldown；根 `package.json` 的 `pnpm.overrides` 也钉了 rolldown-vite，但那个 override 早就失效了（§2）。需求是把 Vite / Rolldown 升到最新。

| 方案                  | 结论                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **真正的 `vite@^8`**  | ✅ 选它。Vite 8 自带 Rolldown（打包）+ Oxc（转换）。`rolldown-vite` 是把 Rolldown 移植到 Vite 7 的过渡包，在 Vite 8 上多余；换过来不损失打包器的好处，还少一个实验性依赖和一个 override（用户拍板） |
| `rolldown-vite@7.3.1` | ❌ 中间一步曾经停在这里（最保守的升级），用户随后明确选择完整迁到 Vite 8                                                                                                                            |

### 1.2 一起升级的包

| 包                        | 之前                      | 2026-07-19 之后                      |
| ------------------------- | ------------------------- | ------------------------------------ |
| `vite`                    | `npm:rolldown-vite@7.2.5` | `^8.1.5`                             |
| `@vitejs/plugin-react`    | `^6.0.1`                  | `^6.0.3`（peer `vite@^8`）           |
| `@tailwindcss/vite`       | `^4.2.4`                  | `^4.3.3`                             |
| `tailwindcss`             | `^4.2.4`                  | `^4.3.3`（和插件保持同步）           |
| `@tanstack/router-plugin` | `^1.167.32`               | `^1.168.22`                          |
| `@tanstack/react-router`  | `^1.169.1`                | `^1.170.18`（router-plugin 的 peer） |

之后的依赖升级又把其中几个往上提了一点，当前版本以 `apps/client/package.json` 为准。

### 1.3 配置不用改

`apps/client/vite.config.ts` 只用了 `plugins`、`resolve.alias`、`server.proxy`、`define`，没有 `rollupOptions` 或 `esbuild` 选项，所以不需要改名成 `rolldownOptions` / `oxc`。迁移提交里这个文件的改动只是格式变化。排查打包问题时记住：底层是 Rolldown。

## 2. pnpm 11 的配置（2026-07-19）

- **pnpm 10 起不再读 `package.json` 里的 `pnpm` 字段**（`overrides`、`onlyBuiltDependencies` 等，见 <https://pnpm.io/settings>）。原来的 `pnpm.overrides` 一直是静默失效的，client 能用上 rolldown-vite 靠的是它自己的 devDependency 别名。这个字段已删。
- 配置全部写在 `pnpm-workspace.yaml`：
  - `allowBuilds`：允许跑安装或构建脚本的依赖，pnpm 11 用它取代 `onlyBuiltDependencies`，`pnpm approve-builds` 会改这张表。现在是 `better-sqlite3`（原生模块）、`esbuild`（平台二进制）、`msw`（worker）、`es5-ext`（postinstall），都是 `true`。
  - `minimumReleaseAgeExclude`：可以绕过 pnpm 发布时间限制的版本（pnpm 会拦下刚发布不久的版本）。现在只有 `hono@4.12.31`。`eslint@10.8.0` 是 2026-07-25 加的，2026-10-21 随 ESLint 一起删掉（见 [lint-format](../lint-format/README.md)）。本仓库没有设置 `minimumReleaseAge`，用的是 pnpm 的默认时长（具体值未确认）。
  - 原来的 `vite` override 已删，不再需要。
- 根 `package.json`：`"packageManager": "pnpm@11.15.0"`。
- 坑：在非交互环境里做需要重建 `node_modules` 的全新安装，要加 `CI=true`；改了 overrides 要加 `--no-frozen-lockfile`。

## 3. TypeScript 版本（2026-10-21）

- 两个 app 都是 `typescript@^6.0.3`。
- TypeScript 7（Go 重写，npm `latest` 是 7.0.2，2026-07-08 发布）已经调研过：可以直接升，现有依赖都能配合；还没升级。详见 [probe-typescript-7.md](probe-typescript-7.md)。
- 升级时要做的事：
  1. 两个 app 的 `typescript` 改成 `^7.0.2`。
  2. 删掉 `hono-mono-starter.code-workspace` 里的 `typescript.tsdk` 和 `typescript.enablePromptUseWorkspaceTsdk`（7.0 的包里没有 `lib/tsserver.js`），推荐 VS Code 扩展 `TypeScriptTeam.native-preview`。
  3. 可选：开类型感知 lint（[lint-format tech.md §3.4](../lint-format/tech.md#34-类型感知规则未开启)）。

## 4. 风险

| 风险                                                                                                                                  | 应对                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite 8 / Rolldown 还新，个别插件可能不兼容                                                                                            | 迁移时整套 vite 相关插件都升到了 peer 支持 `vite@^8` 的版本；出问题先查插件的 peer 范围                                                                               |
| pnpm 配置写错地方会静默失效（`package.json` 的 `pnpm` 字段）                                                                          | 只在 `pnpm-workspace.yaml` 里配；改完用 `pnpm why <包>` 确认生效                                                                                                      |
| 以后引入依赖老 Compiler API 的工具（typescript-eslint、Volar、`vite-plugin-dts` 等），升 TS 7 后会坏                                  | 用官方给的 alias 让 6 和 7 并存：`"typescript": "npm:@typescript/typescript6"` + `"@typescript/native": "npm:typescript@^7"`                                          |
| 2026-07-19 时的 peer 警告（`eslint-plugin-import` 对 eslint 10 等）                                                                   | 2026-10-21 删掉 ESLint 后已经不存在                                                                                                                                   |
| Kubb 5 发版很勤（`kubb` 5.15.3 是 2026-10-29 发的，canary 几乎每天一个），小版本也可能改生成代码（§5）                                | `src/gen/` 和 `openapi.yml` 一起提交，升级后先看 `src/gen/` 的 diff 再提交                                                                                            |
| SSE 经过 Vite dev 代理（`vite.config.ts` 的 `server.proxy['/api']`）会不会被缓冲（§5.5）                                              | 2026-11-07 实测不会：事件按 server 的 0.5 秒间隔逐条到达浏览器，代理配置不用改                                                                                        |
| 经过 Vite dev 代理时 server 中途挂掉，浏览器里的流既不结束也不报错（2026-11-07 实测，§5.5）；生产环境前面的反向代理会不会一样，未验证 | client 加空闲超时，超时就中止并当成断线（§5.6 的 `TickStream`）；长时间没数据的流由 server 定期发心跳事件                                                             |
| notes 路由（`routes/example.ts`）没声明 400，校验失败的 body 是 zod-openapi 默认的 `ZodError` 形式，不是 `ApiError`（§5.7）           | 要统一时把 `defaultHook` 从 `ticksApp` 挪到 `app.ts` 的根 `OpenAPIHono`（1.5.1 的子 app 会往上找父 app 的 `defaultHook`，看代码，未实测），再给带参数的路由都声明 400 |

## 5. Kubb 5 与 SSE 接口（2026-11-04）

### 5.1 起因和选型

起因：要支持返回 SSE（`text/event-stream`）的接口，用户要求把 Kubb 升到 5 的最新版（用户拍板）。

Kubb 5 把"生成 client"拆成了两类插件，SSE 支持在自带运行时的那一类里：

| 方案                        | 结论                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@kubb/plugin-fetch`**    | ✅ 选它。生成基于原生 `fetch` 的函数，运行时随生成代码一起复制到 `src/gen/.kubb/`，不需要额外的 HTTP 依赖。返回 `text/event-stream` 的接口会生成类型化的事件流（§5.5）                       |
| `@kubb/plugin-client`（v5） | ❌ v5 起它不再自带 client：`importPath` 必填，要自己写 client 模块；spec 里有 SSE 接口时还得自己实现 `toEventStream`、`EventStreamResult`、`SuccessOf`。等于把 plugin-fetch 的运行时手抄一遍 |
| `@kubb/plugin-axios`        | ❌ 多一个 axios 依赖，项目一直用 fetch                                                                                                                                                       |

### 5.2 包的变化

| 之前（4.39.2）             | 2026-11-04 之后                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `@kubb/cli` + `@kubb/core` | `kubb@^5.15.3`：总包，带上 `@kubb/cli`、`@kubb/core`、`@kubb/adapter-oas`、`@kubb/plugin-barrel` 等。配置从 `kubb/config` 导入 |
| `@kubb/plugin-oas`         | 删掉。v5 默认用 `@kubb/adapter-oas` 解析 spec，不用写进配置                                                                    |
| `@kubb/plugin-client`      | 换成 `@kubb/plugin-fetch@^5.11.0`                                                                                              |
| `@kubb/plugin-ts`          | `^5.4.0`                                                                                                                       |
| `@kubb/plugin-zod`         | `^5.8.0`                                                                                                                       |

- v5 各包独立发版，版本号对不齐（`kubb` 5.15.3、`plugin-fetch` 5.11.0、`plugin-ts` 5.4.0、`plugin-zod` 5.8.0）。升级时用 `npm view <包> dist-tags` 逐个查 `latest`。**`@kubb/plugin-oas` 的 `latest` 还是 4.39.3，不要装回来。**
- v5 要求 Node `>=22.22`（各包的 `engines`）。
- `@kubb/plugin-ts` 5 运行时不再 `import 'typescript'`，用 `yuku-codegen` 输出代码；`typescript` 只是可选 peer，现在解析到我们装的 6.0.3。[TS 7 调研](probe-typescript-7.md)里"Kubb 自带 `typescript@5.9.3`"那一行已经不成立，但结论不变：Kubb 不用 Compiler API。升 TS 7 时仍要重跑一次 `generate:api` 确认（未验证）。

### 5.3 配置

`apps/client/kubb.config.ts`：

```ts
export default defineConfig({
  input: '../server/openapi.yml',
  output: {
    path: './src/gen',
    clean: true,
    barrel: { type: 'named' },
    format: 'oxfmt',
  },
  plugins: [pluginTs(), pluginFetch({ returnType: 'data' }), pluginZod()],
});
```

- `input` 直接写路径字符串。v4 的 `input: { path }` 在 v5 会报 "Legacy input shape"。
- **插件不传 `output`。** v5 里给插件传自己的 `output` 会替换掉它默认的 `barrel: { type: 'named' }`，`clients/index.ts` 这类 barrel 就没了。三个插件的默认目录 `types`、`clients`、`zod` 和原来一样，不用写。
- `output.barrel: { type: 'named' }`：保留根目录的 `src/gen/index.ts`。v5 默认不生成根 barrel，v4 会生成。
- `format: 'oxfmt'` 保留（[lint-format tech.md §5](../lint-format/tech.md#5-生成文件2026-10-212026-11-04-修订)）。`output.lint` 在 v5 默认是 `false`，v4 是 `'auto'`。
- `returnType: 'data'`：调用直接拿到响应体，和 v4 的行为一样，`dashboard.tsx` 不用改取值方式。但非 2xx 现在会抛 `ResponseError`，调用处要接住（§5.7）。v5 默认是 `'full'`，返回 `{ status, data, error, contentType, request, response }`。要读响应头时对单次调用传 `throwOnError: false`，拿到的就是完整结果。

> 2026-11-04 → 2026-11-07 修订：原来写"`dashboard.tsx` 不用改"。取值方式确实不用改，但出错时的行为变了：v5 抛错，原来的 `handleCreate` 没接，新建失败时页面上什么都没有（code review 发现）。

### 5.4 生成物和调用方式的变化

生成物：

- 新增 `src/gen/.kubb/client.ts`、`serializers.ts`、`standardSchema.ts`：plugin-fetch 的运行时，每次生成都会重新复制。生成代码不再依赖 `@kubb/plugin-client` 这个包。
- 删掉 v4 留下的 `src/gen/.kubb/config.ts` 和 `src/gen/schemas/*.json`（v4 的 plugin-oas 输出的 JSON Schema，没有地方用）。
- 生成文件里的相对 import 不再带 `.ts` 后缀。client 的 tsconfig 是 `moduleResolution: bundler`，没有影响。
- 操作类型改了名，schema 类型（`Note`、`CreateNoteInput`、`ApiError`）不变：

| v4                                           | v5                                                               |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `GetApiNotes200`、`GetApiNotes401`           | `GetApiNotesStatus200`、`GetApiNotesStatus401`                   |
| `GetApiNotesQueryResponse`                   | `GetApiNotesResponse`                                            |
| `PostApiNotesMutationRequest`                | `PostApiNotesBody`                                               |
| `GetApiNotesQuery`（Response / Errors 汇总） | `GetApiNotesResponses`（按状态码）、`GetApiNotesOptions`（参数） |

调用方式：

| 场景     | v4                                                            | v5                                                                                            |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 无参数   | `getApiNotes()`                                               | 不变                                                                                          |
| 带请求体 | `postApiNotes({ title, body })`                               | `postApiNotes({ body: { title, body } })`：参数按 `path` / `query` / `headers` / `body` 分组  |
| 全局配置 | `setConfig(...)`，从 `@kubb/plugin-client/clients/fetch` 导入 | `client.setConfig(...)`，从 `src/gen/.kubb/client` 导入（`apps/client/src/lib/api.ts`）       |
| 非 2xx   | —                                                             | 抛 `ResponseError`，用 `ResponseError.is(error)` 判断，`error.status` 是状态码；怎么接见 §5.7 |

`apps/client/src/lib/api.ts` 只设 `baseURL: ''` 和 `credentials: 'include'`。原来的全局 `Content-Type: application/json` 删了：v5 生成的函数自己带 `contentType`（`postApiNotes` 里是 `contentType: { request: 'application/json' }`）。

### 5.5 SSE 接口怎么写

server 端照常用 `createRoute`，响应的 content type 写 `text/event-stream`，handler 返回 `hono/streaming` 的 `streamSSE(...)`：

```ts
const streamTicks = createRoute({
  method: 'get',
  path: '/api/ticks',
  responses: {
    200: {
      content: { 'text/event-stream': { schema: TickSchema } },
      description: 'Tick events',
    },
  },
});

app.openapi(streamTicks, (c) =>
  streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'tick',
      id: '1',
      data: JSON.stringify({ n: 1 }),
    });
  }),
);
```

- `schema` 描述的是**一条事件的 `data`**，不是整个响应体。照常 `.openapi('Name')`。
- handler 直接返回 `streamSSE(...)` 能通过类型检查，不需要 `@ts-expect-error`（实测，`@hono/zod-openapi` 1.5.1、`hono` 4.12.31）。
- `data` 用 `JSON.stringify` 写。客户端运行时会把 `data` 当 JSON 解析，解析失败就保留原字符串。

client 端生成的函数返回 `EventStreamResult`（`{ stream, response }`），不受 `returnType: 'data'` 影响：

```ts
const { stream, response } = await getApiTicks({ query: { count: 3 } });
for await (const event of stream) {
  event.data; // Tick
  event.event; // 'tick'，可选
  event.id; // '1'，可选
}
```

- 提前停：`break` 会取消底层的 reader。从外面停：传 `signal: controller.signal`，调用 `controller.abort()` 后 `for await` 抛 `AbortError`（实测）。
- 非 2xx 在 `await getApiTicks(...)` 这一步抛 `ResponseError`。**SSE 接口的 `err.data` 是没读的流**，不是类型里写的 JSON（§5.7）。
- **`event.data` 不一定是声明的类型。** 只有 `id:` / `event:` / `retry:`、没有 `data:` 的块，`data` 是 `undefined`；`data` 不是 JSON 时是原字符串（看 `.kubb/client.ts` 的 `parseEvent`，2026-11-07 用脚本喂这两种块实测）。直接读 `event.data.type`，遇到一个 `retry:` 块就抛 `TypeError`。读之前用 plugin-zod 生成的 schema 过一遍（`tickEventSchema.safeParse(event.data)`），不合格的跳过。
- **不会自动重连。** 生成的函数底层是 `fetch`，不是浏览器的 `EventSource`：好处是能用 POST、能带自定义请求头，代价是没有 `EventSource` 的自动重连和 `Last-Event-ID`。断开时有三种表现：

| 情况                                    | client 看到的                                                | 来源                                        |
| --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| server 关闭连接，没发结束事件           | `for await` 静默结束，不抛错                                 | 看 `.kubb/client.ts` 的 `readBytes`，未实测 |
| 直连 server，server 进程中途挂掉        | `for await` 立刻抛 `TypeError: network error`                | 实测（2026-11-07，Chrome）                  |
| 经过 Vite dev 代理，server 进程中途挂掉 | **既不结束也不报错，一直挂着**：代理没有把上游断开传给浏览器 | 实测（2026-11-07，等了 30 秒以上）          |

- 所以 client 要做三件事（[§5.6](#56-示例get-apiticks2026-11-07) 的 `TickStream` 都做了）：
  1. **server 最后发一条明确的结束事件**，client 没收到它就当成断线。正常结束和中途被断开，第一种情况下看起来一样。
  2. `try/catch` 包住调用和 `for await`，接住第二种情况。
  3. **加空闲超时**，接住第三种情况：每收到一个事件重置计时器，超时就 `controller.abort(标记)`，在 `catch` 里用 `controller.signal.reason` 区分"超时"和"用户主动停"。超时要比 server 发事件的最大间隔长。**空闲超时从拿到 stream 之后才开始算**；`await getApiTicks(...)` 返回之前另设一个更长的连接超时，不然 server 冷启动、session 查询慢，还没开始收就被当成断线。
- 流里长时间没有数据可发时，server 要定期发心跳。**心跳必须是带 `data` 的事件**，不能用 SSE 注释（`: ping`）：运行时的 `parseEvent` 会跳过 `:` 开头的行，只有注释的块不会从 `for await` 出来，重置不了 client 的计时器（看代码）。
- 要续传：client 记住最后一个事件的 `id`，断线后带上它重新调用；server 要能从这个 `id` 往后发。**这个 `id` 得在 route 里声明成参数**（`request.query` 或 `request.headers`）：没声明的话，生成的类型是 `headers?: never`，调用时传不进去。
- SSE 请求走同一个 `client`，`api.ts` 里的 `credentials: 'include'` 一样生效（看的是 `.kubb/client.ts` 的 `defaultTransport`），要登录的 SSE 接口照常挂 `requireAuth`。
- 经过 Vite dev 代理不会被缓冲（2026-11-07 实测）。

> 2026-11-04 → 2026-11-07 修订：原来写"仓库里还没有 SSE 接口"，断线只列了两种情况且都没实测。现在有了示例接口（§5.6），断线行为实测过，补上了经过代理时一直挂着的情况和空闲超时。
>
> 2026-11-07 再次修订（code review）：补上 `event.data` 可能是 `undefined` 或字符串、SSE 出错时 `err.data` 是流；空闲超时原来在请求发出前就开始算，现在拿到 stream 之后才算，连接阶段单独超时。

### 5.6 示例：`GET /api/ticks`（2026-11-07）

用户要一个能跑的 SSE 示例（用户追加）。

| 位置                                               | 内容                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/server/src/routes/ticks.ts`（新）            | `ticksApp`：`GET /api/ticks`，要登录（`requireAuth`）。每 0.5 秒（`TICK_INTERVAL_MS`）发一条 tick，`id` 是序号，最后发一条 done 收尾；client 断开后（`stream.aborted`）不再发；参数不合法返回 `ApiError` 形式的 400（`defaultHook`，§5.7） |
| `apps/server/src/app.ts`                           | 挂载 `ticksApp`                                                                                                                                                                                                                            |
| `apps/client/src/components/tick-stream.tsx`（新） | `TickStream`：dashboard 右栏的 "Live stream" 卡片                                                                                                                                                                                          |
| `apps/client/src/lib/api.ts`                       | `errorMessage`：把各种错误转成一句给人看的话（§5.7）                                                                                                                                                                                       |
| `apps/client/src/pages/dashboard.tsx`              | 右栏放进 `TickStream`；笔记加载、新建失败时显示原因（§5.7）                                                                                                                                                                                |

接口：

- query：`count`（1～50，默认 10）一共发几条；`after`（≥ 1，可选）上次收到的最后一个 `id`，从它的下一条开始发。
- 每条事件的 `data` 是 `TickEvent`：`{ type: 'tick', n, total, at }` 或 `{ type: 'done', total }`，用 `zod` 的 `discriminatedUnion` 定义。client 先用生成的 `tickEventSchema` 校验（§5.5），判断 `parsed.data.type === 'done'` 之后，TypeScript 会自动收窄到 `Tick`。**没用 SSE 的 `event` 字段区分**：一个响应只有一个 schema，`event` 的名字进不了类型，`data.type` 能。
- `after` 写成 `min(1)` 的可选参数，不写成 `min(0).default(0)`：zod 4 认为 `z.coerce.number()` 的输入可以是 `null`（`Number(null)` 是 0，满足 `min(0)`），spec 里就成了 `integer | null`，client 的类型变成 `after?: number | null`。`min(1)` 时 `null` 过不了校验，spec 就是干净的 `integer`（实测）。
- 没登录返回 401 和 JSON 的 `ApiError`，client 在 `await getApiTicks(...)` 这一步抛 `ResponseError`。401 先于参数校验：没登录时参数再错也是 401（实测）。
- 参数不合法（如 `count=100`、`after=0`、`count=abc`）返回 400 和 `ApiError`，`error` 写明哪个参数错了，如 `count: Too big: expected number to be <=50`（实测，§5.7）。

`TickStream` 的状态：

| 状态        | 什么时候                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `streaming` | 正在读                                                                                                                         |
| `done`      | 收到 `type: 'done'`                                                                                                            |
| `stopped`   | 点了 Stop（`controller.abort()`），组件卸载时也会中止                                                                          |
| `dropped`   | 流结束了却没收到 done；拿到 stream 之后 3 秒（`IDLE_TIMEOUT_MS`）没收到事件；或者 10 秒（`CONNECT_TIMEOUT_MS`）还没拿到响应    |
| `error`     | 其它异常，显示 `errorMessage` 转出来的原因（§5.7）：401 显示 `Unauthorized`，直连时 server 挂掉显示 `TypeError: network error` |

`stopped` / `dropped` / `error` 时，只要收到过 tick 又没收完，就显示 "Resume from #N"：把最后一个 tick 的 `n` 作为 `after`、它的 `total` 作为 `count` 重新调用，列表接着往下加。`n` 和事件的 `id` 是同一个数，所以不单独存 `id`；总数也从 tick 里读，`COUNT = 10` 只是第一次请求的参数。

> 2026-11-07 修订（code review）：原来 client 写死总数 `TOTAL = 10`，另存一份最后一个事件的 `id`，3 秒空闲超时在请求发出前就开始算，直接读 `event.data.type`。现在总数和续传位置都从最后一个 tick 读，连接阶段用 10 秒的连接超时，事件先过 zod 校验。

怎么看：

1. 浏览器：`pnpm dev:server` 和 `pnpm dev:client` 起来，登录后打开 dashboard，右栏 "Live stream" 卡片点 Start，事件每 0.5 秒一条。中途点 Stop，再点 Resume，会从断开的下一条接着收。
2. curl 看原始事件流。下面用的是开发环境自动登录的接口，要开 `DEV_AUTO_LOGIN`（见 [开发环境自动登录](../dev-auto-login/README.md)）；没开就从浏览器复制 cookie：

```bash
curl -s -c /tmp/jar -X POST localhost:3000/api/auth/dev/sign-in
curl -N -b /tmp/jar 'localhost:3000/api/ticks?count=3'
```

```text
data: {"type":"tick","n":1,"total":3,"at":"2026-11-07T02:30:24.129Z"}
id: 1

data: {"type":"tick","n":2,"total":3,"at":"2026-11-07T02:30:24.630Z"}
id: 2

data: {"type":"tick","n":3,"total":3,"at":"2026-11-07T02:30:25.131Z"}
id: 3

data: {"type":"done","total":3}
```

### 5.7 非 2xx 的处理（2026-11-07）

code review 发现的几个问题，用户要求都修（用户拍板）。

- **Kubb 5 生成的函数遇到非 2xx 一律抛 `ResponseError`**，`returnType: 'data'` 不改变这一点。v4 的 fetch client 不抛（code review 指出，没有回头实测 v4）。所以调用处要 `try/catch` 或 `.catch`。不接的话，session 过期时提交表单只会在控制台留一个未处理的 rejection，页面上什么都没有。
- `apps/client/src/lib/api.ts` 的 `errorMessage(err)` 把错误转成一句给人看的话：
  1. 不是 `ResponseError`（比如 `TypeError: Failed to fetch`）→ `String(err)`。
  2. `err.data` 是 `ReadableStream` → 先用 `new Response(err.data).json()` 读成 JSON，读不出来当成没有。
  3. 符合 plugin-zod 生成的 `apiErrorSchema` → 用它的 `error` 字段，比如 `Unauthorized`。
  4. 都不是 → `HTTP <状态码>`。
- **SSE 接口出错时 `err.data` 是没读的流。** 生成的 SSE 函数（如 `src/gen/clients/getApiTicks.ts`）不管状态码，都写死 `responseType: 'stream'`；运行时的 `defaultTransport` 于是把 `response.body` 原样当成 `data`。所以 401 时 `err.data` 不是类型里写的 `ApiError`。`errorMessage` 的第 2 步就是为它准备的，读完也顺带释放了这个 body。这是生成代码的行为，我们改不了；以后 Kubb 改成先解析 JSON，`errorMessage` 也照样能用。
- `apps/client/src/pages/dashboard.tsx`：`getApiNotes` 失败时，列表的位置显示 "Couldn’t load notes." 和原因；`postApiNotes` 失败时，表单里显示原因，标题和正文保留，可以直接重试。
- **400 的形式。** `@hono/zod-openapi` 参数校验失败时，默认返回 `{ "success": false, "error": { "name": "ZodError", "message": "<issues 的 JSON 字符串>" } }`，不是 `ApiError`（实测）。`ticksApp` 构造时传 `defaultHook`，把 issues 拼成一句：`{ "error": "count: Too big: expected number to be <=50" }`；路由同时声明 `400: ApiError`，spec 和生成的类型里就有了 `GetApiTicksStatus400`。notes 路由（`routes/example.ts`）这次没改，见 §4 风险表。
- 代价：client 第一次在运行时用 plugin-zod 生成的 schema（`apiErrorSchema`，还有 §5.5 的 `tickEventSchema`），zod 进了打包结果。`vite build` 的主 chunk 从 387.62 kB（gzip 126.83 kB）涨到 454.43 kB（gzip 144.51 kB），多了约 67 kB，gzip 后约 18 kB（实测）。嫌大的话，可以换成手写的类型判断。

## 6. client 接入 `pnpm typecheck`（2026-11-07）

- 根 `package.json` 的 `typecheck` 是 `pnpm -r run typecheck`，只跑定义了 `typecheck` 脚本的包。client 以前没有这个脚本，所以 `pnpm typecheck` 只检查 server，client 的类型错误要到 `pnpm build`（`tsc -b && vite build`）才暴露。Kubb 升到 5 时 `postApiNotes` 的调用方式变了，正是这种情况（code review 发现）。
- 现在 `apps/client/package.json` 加了 `"typecheck": "tsc -b"`。`tsconfig.app.json` 和 `tsconfig.node.json` 都是 `noEmit: true`，`tsc -b` 只在 `node_modules/.tmp/` 写 `.tsbuildinfo`，不产出 JS。
- 全仓库 `pnpm typecheck` 约 1.9 秒（实测，两个包并行，增量缓存是热的）。在 client 里故意写一个类型错误，`pnpm typecheck` 能报出来，并以非 0 退出（实测）。
