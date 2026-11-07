---
name: toolchain
title: 构建与依赖
description: client 用真正的 vite@8（自带 Rolldown 打包和 Oxc 转换，不再用 rolldown-vite 和 overrides 钉版本）；pnpm 11 的配置全部放在 pnpm-workspace.yaml（allowBuilds 构建脚本白名单、minimumReleaseAgeExclude 发布时间豁免、package.json 里 pnpm 字段已失效的教训）；packageManager 版本；TypeScript 版本（现在是 6，能不能升 7：Compiler API 被移除后哪些依赖受影响、构建和 lint 是否都能配合）；Kubb 5（kubb 总包 + @kubb/plugin-fetch 取代 plugin-client / plugin-oas，kubb.config.ts 的写法，src/gen/.kubb/ 运行时，returnType: 'data'，生成函数按 path / query / body 分组传参，client.setConfig）和 SSE（text/event-stream）接口在 server 用 createRoute + streamSSE、在 client 用 for await 读事件流，断线的三种表现、连接超时和空闲超时、续传、事件 data 要用生成的 zod schema 校验；非 2xx 抛 ResponseError，lib/api.ts 的 errorMessage 把错误（包括 SSE 接口出错时没读的流）转成一句话；示例接口 GET /api/ticks（apps/server/src/routes/ticks.ts）和 dashboard 的 Live stream 卡片（TickStream）；client 接入 pnpm typecheck（tsc -b）。升级 Vite / pnpm / TypeScript / Kubb、装依赖时报构建脚本被拦或版本太新、排查打包问题、写 SSE 接口、生成的 client 调用方式不对或处理接口报错时来读。
changes: [2026-07-19, 2026-07-25, 2026-10-21, 2026-11-04, 2026-11-07]
status: 已上线
code:
  - apps/client/vite.config.ts
  - apps/client/package.json
  - apps/client/kubb.config.ts
  - apps/client/src/lib/api.ts
  - apps/server/src/routes/ticks.ts
  - apps/client/src/components/tick-stream.tsx
  - apps/client/src/pages/dashboard.tsx
  - apps/server/src/middleware/auth.ts
  - pnpm-workspace.yaml
  - package.json
---

# 构建与依赖

client 用真正的 `vite@8`：Vite 8 自带 Rolldown（打包）和 Oxc（转换），所以不再需要 `rolldown-vite` 这个过渡包，也不用 overrides 钉版本。pnpm 是 11，它的配置全部写在 `pnpm-workspace.yaml`：哪些依赖允许跑安装脚本（`allowBuilds`）、哪些版本可以绕过发布时间限制（`minimumReleaseAgeExclude`）。两个 app 的 TypeScript 都是 6；Go 重写的 TypeScript 7 已经发布，2026-10-21 调研过，现有依赖都能配合，但还没升级。client 的 API 代码由 Kubb 5 生成，用 `@kubb/plugin-fetch`，返回 `text/event-stream` 的接口会生成类型化的事件流，`GET /api/ticks` 是能跑的示例。

## 关键决定

- client 从 `rolldown-vite@7.2.5` 迁到真正的 `vite@^8`，删掉 `rolldown-vite` 和 override（用户拍板，2026-07-19，见 [tech.md §1](tech.md#1-vite-82026-07-19)）
- pnpm 配置从 `package.json` 的 `pnpm` 字段搬到 `pnpm-workspace.yaml`：pnpm 10 起不再读那个字段，原来的 override 早就静默失效了（2026-07-19，见 [tech.md §2](tech.md#2-pnpm-11-的配置2026-07-19)）
- TypeScript 7 可以直接升，构建、codegen、lint 全部实测通过；暂不升级（2026-10-21，见 [probe-typescript-7.md](probe-typescript-7.md)）
- Kubb 从 4.39 升到 5，`@kubb/plugin-client` 换成自带 fetch 运行时、支持 SSE 的 `@kubb/plugin-fetch`；用 `returnType: 'data'` 保持调用直接拿到响应体（用户拍板升级，2026-11-04，见 [tech.md §5](tech.md#5-kubb-5-与-sse-接口2026-11-04)）
- SSE 示例 `GET /api/ticks` 加 dashboard 的 "Live stream" 卡片；client 必须加空闲超时，因为经过 Vite 代理时 server 挂掉，浏览器里的流会一直挂着（用户要示例，超时是实测发现，2026-11-07，见 [tech.md §5.6](tech.md#56-示例get-apiticks2026-11-07)）
- 生成的函数遇到非 2xx 会抛错，调用处都要接住，用 `errorMessage` 显示原因；SSE 接口出错时错误 body 是没读的流，事件 `data` 也要先过 zod 校验。client 加了 `typecheck` 脚本，`pnpm typecheck` 不再只查 server（code review 发现，用户要求修，2026-11-07，见 [tech.md §5.7](tech.md#57-非-2xx-的处理2026-11-07)、[§6](tech.md#6-client-接入-pnpm-typecheck2026-11-07)）

## 文件

| 文件                                           | 内容                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tech.md](tech.md)                             | §1 Vite 8 选型、一起升级的包、配置为什么不用改；§2 pnpm 11 的配置项和坑；§3 TypeScript 版本现状和升 7 要做的事；§4 风险表；§5 Kubb 5：选型、包和配置的变化、生成物和调用方式、SSE 接口怎么写（断线和超时、事件校验）、示例 `GET /api/ticks`、非 2xx 的处理（`errorMessage`、400 的形式、zod 的打包代价）；§6 client 的 `pnpm typecheck` |
| [probe-typescript-7.md](probe-typescript-7.md) | 能不能升 TS 7：逐个环节的实测结果和耗时、谁在运行时用 `typescript`、tsconfig、编辑器、peer 依赖、建议                                                                                                                                                                                                                                   |
| [plan.md](plan.md)                             | 2026-07-19 迁到 Vite 8；2026-07-25 依赖小升级；2026-10-21 TS 7 调研、去掉 eslint 的发布时间豁免；2026-11-04 升到 Kubb 5 并验证 SSE；2026-11-07 加 SSE 示例和空闲超时，以及 code review 修复                                                                                                                                             |
| [verification.md](verification.md)             | Vite 8 迁移的检查表；手动验收；2026-07-19、2026-10-21、2026-11-04、2026-11-07 的实际结果                                                                                                                                                                                                                                                |

## 相关模块

- [代码规范与格式化](../lint-format/README.md)：类型感知 lint 规则要 TS 7；Vite 8 用的 Oxc 和 lint 用的 Oxc 是同一个工具链。
- [提交流程](../commit-workflow/README.md)：和 Vite 8 迁移在同一个分支 `chore/vite8-migration` 上做的。
