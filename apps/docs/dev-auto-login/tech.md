# 开发环境自动登录：技术实现

> 相关：[模块说明](README.md) · [施工计划](plan.md) · [验证方案](verification.md)

## 1. 用法和行为（2026-11-01）

两个变量缺一不可，配好后重启两个 dev server：

```bash
# <repo>/.env（server 和 client 都读）
DEV_AUTO_LOGIN=true

# apps/server/.env（只有 server 读）
NODE_ENV=dev
```

- `NODE_ENV` 必须正好是 `dev`：`development`、不设置、`production` 都不生效（§2）。它要写在 `apps/server/.env`，**不要写在根 `.env`**：`vite.config.ts` 也读根 `.env`，Vite 遇到不是 `development` 的 `NODE_ENV` 每次启动都会报 warning（实测）。
- `DEV_AUTO_LOGIN` 必须写在根 **`.env`**，不能写在根 `.env.local` / `.env.development`：Vite 的 `loadEnv` 会读那些文件，但 server 的 dev 脚本只读 `.env`。两边对不上时 client 会去调用，server 却没有这个端点。`SERVER_PORT` 等共享变量也有同样的限制。

生效后：

- 没登录时打开任意受保护页面（`_app` 下的路由），会自动以 `test@test.com` 登录，停在原页面。
- 第一次使用时自动创建这个用户：name `Test User`，`emailVerified: true`，**没有密码**，所以不能用登录表单登录这个账号。之后一直复用同一个用户，notes 等数据跨会话保留。
- **登出后停在 `/login`，不会马上被自动登录回去**，登录、注册流程照样能测。再打开 `/` 等受保护页面时才会重新自动登录。
- 已经用别的账号登录时不受影响：只在没有 session 时触发。
- server 启动日志：生效时打印 `DEV_AUTO_LOGIN is on — any local client can sign in as test@test.com`；只开了 `DEV_AUTO_LOGIN`、`NODE_ENV` 不对时打印 `DEV_AUTO_LOGIN is ignored — it requires NODE_ENV=dev (got …)`。
- 自动登录失败时，浏览器控制台有一条 `DEV_AUTO_LOGIN:` 开头的 warning，然后照常跳 `/login`（§4.3）。
- **开着这个功能时不要用 `vite --host`**（§5）。

## 2. 开关（2026-11-01）

- server：`apps/server/src/dev-login.ts` 的 `devAutoLoginRequested`（`DEV_AUTO_LOGIN === 'true'`）和 `devAutoLoginEnabled`（再加上 `NODE_ENV === 'dev'`）。只有 `devAutoLoginEnabled` 为真时，`apps/server/src/auth.ts` 才把插件放进 `plugins`，`apps/server/src/routes/auth.ts` 才注册路由；否则端点不存在，返回 404。
- 用白名单（必须是 `dev`），不用黑名单（只要不是 `production`）：任何没明确声明成 dev 的启动方式都不会带上这个后门（用户追加："这个环境变量必须配合 NODE_ENV=dev 才能生效"）。
- 启动日志在 `apps/server/src/index.ts`，内容见 §1。
- `NODE_ENV=dev` 对 better-auth 的附带影响：better-auth 把 `dev` 和 `development` 都当成开发环境，所以会多一些开发日志，取不到客户端 IP 时按 localhost 算限流。开发时无所谓。
- 生产启动脚本 `pnpm start` 读的是 `.env.production`，不读根 `.env` 和 `apps/server/.env`。
- client 另外读一次 `DEV_AUTO_LOGIN`（§4.1），但不看 `NODE_ENV`。开了 `DEV_AUTO_LOGIN` 而 server 没设 `NODE_ENV=dev` 时，client 每次没登录进受保护页面都会试一次，拿到 404 后打 warning、跳 `/login`。两边各判断一次可能对不上（比如开关写进了 `.env.local`）；让 client 不看开关的方案没采用，见 §6。

## 3. 服务端（`apps/server/src/dev-login.ts`、`apps/server/src/routes/auth.ts`）（2026-11-01）

`dev-login.ts`（新）是一个 better-auth 插件，提供 `auth.api.devSignIn`：按 email 找用户，找不到就创建，然后用 `internalAdapter.createSession` + `setSessionCookie` 下发正常的 session cookie。之后的请求和真实登录完全一样，`requireAuth`、`getSession` 都不用改。

### 3.1 server-only 端点和单独的路由

- 端点用 `createAuthEndpoint.serverOnly` 声明：没有路径，又标了 `SERVER_ONLY`，better-auth 的 HTTP 路由不会把请求分给它，只能通过 `auth.api.devSignIn` 调用。
- 唯一的 HTTP 入口是 `routes/auth.ts` 在 catch-all 之前注册的 `POST /api/auth/dev/sign-in`：先跑 `devLoginLocalOnly()`（§3.2），再调 `auth.api.devSignIn({ request: c.req.raw, asResponse: true })`。传 `request` 是为了让 CSRF 检查能看到请求头（§3.3）；`asResponse` 让 better-auth 直接返回带 `Set-Cookie` 的 `Response`，出错时也是正常的 4xx 响应（实测 CSRF 失败返回 403 `INVALID_ORIGIN`）。
- 为什么不在 Hono 里给 `/api/auth/dev/*` 挂个中间件、端点照常交给 better-auth：那样检查挂在 Hono 的路由上，处理请求的却是 better-auth 自己的路由，安全性取决于两套路由对路径的匹配始终一致。只要有一种写法 Hono 不认、better-auth 认，就能绕过检查（code review 指出）。现在 Hono 不认的写法会落到 catch-all，而 better-auth 那边根本没有这个路由，返回 404。实测 11 种路径写法见 [verification.md](verification.md)。

> 2026-11-01 修订（第二轮 code review）：原来端点是普通的 `createAuthEndpoint('/dev/sign-in', …)`，本机检查是挂在 `/api/auth/dev/*` 上的 Hono 中间件。理由见上一条。

### 3.2 只接受本机请求

`devLoginLocalOnly()` 返回一个 Hono 中间件。server 监听所有网卡，所以下面两条都满足才放行，否则返回 403：

1. socket 来自本机（`isOwnAddress`）：loopback（`127.*`、`::1`），或本机任一网卡的地址（`os.networkInterfaces()`）。这条挡住局域网里的其他机器。比较前去掉 `::ffff:` 前缀和 IPv6 地址的 `%网卡` 后缀。
2. `Host` 是本地名字：`localhost`、`127.0.0.1`、`[::1]`、`SERVER_URL` 的 hostname。这条挡住 DNS rebinding（恶意域名解析到 127.0.0.1，浏览器把它当成同源）。

- 走 Vite 代理的请求两条都满足：它们来自本机的 Vite 进程，`changeOrigin: true` 把 `Host` 改写成 `SERVER_URL` 的 host。
- 算上网卡地址，是因为 `SERVER_URL` 设成局域网 IP（比如为了用手机访问）时，Vite 代理是从这个 IP 连过来的，socket 地址不是 127.x，只认 loopback 会一直 403（code review 指出）。网卡地址每次请求时现读，换网络后不用重启。
- 它是个工厂函数，`SERVER_URL` 只在功能开启、注册路由时才解析，功能关闭时不会因为它出错。不过 `SERVER_URL` 写错格式时 better-auth 自己启动也会报 `Invalid base URL`，server 照样起不来（实测）。
- 用 `vite --host` 时这条检查形同虚设，见 §5。

> 2026-11-01 修订（第二轮 code review）：原来只认 loopback；`Host` 白名单在模块加载时就解析 `SERVER_URL`，功能关闭时也一样。

### 3.3 CSRF 检查

- 直接调用 `auth.api.*` 会跳过 better-auth HTTP 路由层的检查：`originCheckMiddleware`（`Origin` 必须在 `trustedOrigins` 里）和只接受 JSON content type。不补的话，你浏览的任何网站都能用一个表单 POST 把你登录成 test 用户（Claude 改 §3.1 时发现）。
- 所以端点挂了 better-auth 的 `formCsrfMiddleware`（`use: [formCsrfMiddleware]`），和 email 登录用的是同一套：跨站的表单提交（`Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate`）、`Origin` 不在 `trustedOrigins` 里的请求都返回 403。浏览器发的请求必须带可信的 `Origin`；不带 `Origin`、也没有 `Sec-Fetch-*` 头的本机 curl 不受影响。
- `trustedOrigins` 来自 `auth.ts`（`CLIENT_URL`）。走 Vite 代理时 `Origin` 就是 `CLIENT_URL`：`changeOrigin` 只改 `Host`，不改 `Origin`。

### 3.4 首次使用的并发

多个 tab 同时首次登录时，几个请求都发现用户不存在，都去 `createUser`，后面的会撞上 `user.email` 的唯一约束（code review 指出，实测原来 3 个并发请求有 2 个返回 500）。现在 `createUser` 抛错后重新查一次用户，查到就用，查不到才把原来的错误抛出去。

### 3.5 残留的 `dont_remember` cookie

浏览器里可能留着之前"不记住我"登录时的 `better-auth.dont_remember` cookie。只要它在：

- `setSessionCookie` 不传第三个参数时会据此推断 `dontRememberMe`，下发不带 `Max-Age` 的会话级 cookie，和数据库里 session 7 天的过期时间对不上；
- `getSession` 看到它就不给 session 续期。

所以端点显式传 `setSessionCookie(ctx, …, false)`，再用 `expireCookie` 把残留的 cookie 设成 `Max-Age=0`（code review 指出）。better-auth 自带的 email 登录（`rememberMe: true`）也不清这个 cookie，这里没有跟它一样。

### 3.6 不进 `openapi.yml`

路径在 better-auth 的 `/api/auth/*` 下，用普通 Hono 路由注册，不走 `createRoute`（CLAUDE.md 允许 `/api/auth/*` 例外），所以不进 `openapi.yml`，也不影响 Kubb 生成的 client。

## 4. 客户端（2026-11-01）

### 4.1 `vite.config.ts`：注入开关和 dev / build 的判断

- 开关以 `import.meta.env.VITE_DEV_AUTO_LOGIN`（boolean）的形式 `define` 进去，类型声明在 `apps/client/src/vite-env.d.ts`。值是 `isServe && env.DEV_AUTO_LOGIN === 'true'`，`isServe` 即 `command === 'serve'`。
- 判断依据是 `command`（`vite` 还是 `vite build`），不是 `mode`：**任何 `vite build`（包括 `--mode development`）里它都是 `false`**，dev-login 代码被删掉（§4.4）。原来按 `mode === 'development'` 判断，`vite build --mode development` 打出的包会保留这段代码（第一轮 code review 指出）。
- `VITE_API_URL` 用同一个判断：`vite`（任何 mode）都不设置它，client 用相对路径 `/api/*`，经 Vite 的代理访问 server（同源，没有 CORS 预检）；`vite build`（任何 mode）都写死成 `SERVER_URL`。代理只存在于 dev server，所以按 `command` 判断才对得上。

> 2026-11-01 修订（第二轮 code review 第 8 条，用户选择统一）：原来 `VITE_API_URL` 按 `mode === 'development'` 判断，和开关的判断依据不同。那时 `vite --mode staging` 的请求绕过代理直连 server，`vite build --mode development` 打出的包用相对路径。

### 4.2 client 插件 `devSignIn()`

`apps/client/src/lib/auth-client.ts` 里有一个小的 better-auth client 插件，提供 `authClient.devSignIn()`：发 `POST /dev/sign-in`，成功后 `$store.notify('$sessionSignal')`，让 `useSession()` 刷新。返回值和其他 better-auth 调用一样是 `{ data, error }`；请求本身失败（比如连接断开）时会抛异常。

- 请求不带 body：它不经过 better-auth 的 HTTP 路由（§3.1），不要求 JSON content type。
- 没用 `$InferServerPlugin` 从 server 插件推断类型：那要让 client 引入 server 的 TypeScript 类型，而 client 目前只通过 OpenAPI / Kubb 认识 server。手写的 action 只有几行（第二轮 code review 第 6 条，用户确认不改）。

> 2026-11-01 修订：原来带 `body: {}`。那时请求经过 better-auth 的路由，没有 JSON content type 会返回 415。

### 4.3 守卫 `apps/client/src/routes/_app.tsx`

`beforeLoad` 的顺序：

1. `authClient.getSession()` 有 session → 放行。
2. 开关打开，**并且 `getSession()` 成功返回了"没有 session"** → 调 `devSignIn()`，成功就放行。`getSession()` 返回错误时（比如 server `--watch` 重启期间代理返回 502）不自动登录，以免把你正在用的账号换成 test 用户（第一轮 code review 指出）。
3. `devSignIn()` 返回错误时打 `DEV_AUTO_LOGIN: dev sign-in failed (HTTP <状态码>); see the server log`；请求本身抛异常时打 `DEV_AUTO_LOGIN: dev sign-in request failed`（第二轮 code review 指出，原来会进错误页）。两种情况都接着走第 4 步。
4. 跳 `/login`。

`_auth.tsx`（`/login`、`/register`）不做自动登录，所以登出后停在 `/login`（§1）。每次没登录进受保护页面都会再试一次，不会记住"试过了"。

### 4.4 构建产物里没有 dev-login 代码

`VITE_DEV_AUTO_LOGIN` 在 build 时是字面量 `false`：插件只在它为真时放进 `plugins`，`_app.tsx` 里的分支也被当成死代码删掉。实测 `production`、`development` 两种 mode 的构建产物里都搜不到 `dev/sign-in`、`devSignIn`、`dev-login`。这只是不留多余代码，**不是安全防线**（§5）。

## 5. 安全边界（2026-11-01）

- 生效时，**本机上的任何进程都能以 test 用户登录**，这是功能本身。浏览器里其他网站的页面会被 CSRF 检查挡住（§3.3）。
- **唯一的闸门在 server**：`DEV_AUTO_LOGIN=true` 且 `NODE_ENV=dev` 才有这个端点（§2），并且只接受本机请求（§3.2）。client 构建产物里没有这段代码不算防线：端点存不存在只取决于 server。
- **开着这个功能时不要用 `vite --host`。** "只限本机"的前提是 Vite 默认只监听 localhost。`--host` 把 dev server 开放给局域网，局域网设备经 Vite 代理发出的请求在 server 看来都来自本机的 Vite 进程，会被放行（Claude 发现，code review 没提）。
- 不要在任何对外可访问的环境里打开它。

## 6. 没采用的方案（2026-11-01）

| 方案                                                    | 结论                                                                                                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV !== 'production'` 就生效                      | ❌ 黑名单：没设 `NODE_ENV` 的部署也会带上后门。用户要求必须是 `dev`                                                                                                                                        |
| client 不看开关，dev 下没登录就试一次，404 就当没开     | ❌ 好处是只有 server 一处判断，不会对不上；代价是不用这个功能的人每次都会在 Network 面板里看到一个 404。保留两处判断，文档写明必须放在根 `.env`（第一轮 code review，用户只要求修建议的 7 条，按现状保留） |
| 本机检查做成 Hono 中间件，挂在 `/api/auth/dev/*` 上     | ❌ 依赖两套路由的路径匹配一致（§3.1）。第一版是这样做的，第二轮 code review 后改掉                                                                                                                         |
| server 只监听 `127.0.0.1`                               | ❌ 影响整个 server；`SERVER_URL` 设成局域网 IP 时也用不了                                                                                                                                                  |
| `DEV_AUTO_LOGIN` 写在 `apps/server/.env` 时 client 也读 | ❌ 违反"client 不读 `apps/server/.env`"的约定（CLAUDE.md）。写错位置时 server 开了端点、client 不调用，由文档说明（第二轮 code review 第 5 条，用户确认不改）                                              |
| client 用 `$InferServerPlugin` 推断插件类型             | ❌ 见 §4.2                                                                                                                                                                                                 |

## 7. 风险

| 风险                                                                                                                                                                       | 应对                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 用到了 better-auth 的内部 API：`internalAdapter`、`createAuthEndpoint.serverOnly`、`formCsrfMiddleware`、`expireCookie`、`ctx.context.authCookies`。升级时可能改名或改行为 | `pnpm typecheck` 能发现改名；行为变化靠 [verification.md](verification.md) 的手动验收清单重新过一遍，特别是路径变体不能出现 200 |
| `vite --host` 让局域网设备经代理被放行                                                                                                                                     | 文档写明（§5）；代码里没拦                                                                                                      |
| `DEV_AUTO_LOGIN` 写在 `.env.local` 时两边对不上                                                                                                                            | 文档写明（§1）；client 会打 warning                                                                                             |
| 每次自动登录都新建一条 session 记录                                                                                                                                        | 正常登录也是这样；只有 cookie 存不住时才会一直累积，没处理                                                                      |
