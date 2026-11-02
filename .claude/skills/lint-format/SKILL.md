---
name: lint-format
description: 代码规范与格式化的操作指南和设计记录：全仓库一套 Oxlint + Oxfmt（根目录 .oxlintrc.json / .oxfmtrc.json，没有 ESLint、Prettier）；pnpm lint / format / lint:fix；scripts/format.sh（pnpm format、Claude 的 PostToolUse hook、pre-commit 钩子共用）；import 和 Tailwind class 排序；生成文件怎么忽略；类型感知规则；oxlint prefer-const 自动修复的已知 bug。改 lint 规则或格式化选项、看不懂 pnpm lint 的报错、新增生成文件、自动格式化的结果不对、升级 oxlint / oxfmt、想开类型感知规则时使用。
---

# 代码规范与格式化

Oxlint 查代码问题，Oxfmt 管格式，配置只有根目录两份，两个 app 共用。日常不用管代码风格：Claude 每改完一个文件，PostToolUse hook 就对它跑一遍 `scripts/format.sh`；提交时 pre-commit 钩子再对暂存的文件跑一遍。收尾跑 `pnpm lint`。

## 命令

| 命令            | 做什么                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| `pnpm lint`     | `oxlint && oxfmt --check && pnpm docs:check`，有 warning 也失败                   |
| `pnpm format`   | `sh scripts/format.sh`：两遍 `oxlint --fix`，再 `oxfmt`，效果和在编辑器里保存一样 |
| `pnpm lint:fix` | 先 `pnpm format`，再跑 `oxlint` 报告修不掉的问题                                  |

`scripts/format.sh` 不带参数时处理整个仓库，带参数时只处理传进来的文件，Markdown、JSON 也可以传。

## pnpm lint 报错时

1. 先跑 `pnpm format`。`curly`、`one-var`、`prefer-const`、import 顺序、Tailwind class 顺序和格式问题都会自动修好。三层以上不带括号的嵌套两遍修不完，再跑一次。
2. 剩下的手动改，例如 `no-explicit-any`、未使用的变量（以 `_` 开头的不报）、React hooks 规则（只在 client 开）。
3. 确实要压制：`// oxlint-disable-next-line <rule>`，后面跟一句原因。没用上的 disable 注释本身会报 warning。
4. `oxfmt --check` 失败、`pnpm format` 也改不动：通常是语法错误。
5. `pnpm docs:check` 报错（索引过期、引用或链接失效）：见 `feature-docs` skill。

## 改规则或格式化选项

- 只改根目录的 `.oxlintrc.json` / `.oxfmtrc.json`，子包不建配置、不加 `lint` 脚本。只对某个包生效的规则写进根配置的 `overrides`（client 的在 `apps/client/**`）：oxlint 的嵌套配置不会自动合并。
- `.oxlintrc.json` 写了 `plugins` 就会替换默认集合，加插件时原有的都要留着。
- 改完跑 `pnpm format`，看一眼 diff（规则改动可能牵动很多文件），再跑 `pnpm lint`。大面积的格式变化单独提交。
- 在 [references/tech.md](references/tech.md) 对应章节记下改了什么、为什么（§3 规则组成，§4 oxfmt 选项），写法按 `feature-docs` skill。代码风格不写进 CLAUDE.md，交给 hook。

## 新增生成文件

按 [tech.md §5](references/tech.md#5-生成文件2026-10-21) 的表决定加进哪份配置的 `ignorePatterns`，并把新生成物补进那张表。Kubb 生成的 `apps/client/src/gen/**` 例外：`kubb.config.ts` 设了 `format: 'oxfmt'`，靠 oxfmt 格式化，**不能**加进 `.oxfmtrc.json` 的忽略列表，否则 Kubb 这一步会变成空操作。

## 自动格式化的结果不对

- 多变量的 `let` 被改成了 `const`，运行时报 `Assignment to constant variable`：oxlint `prefer-const` 自动修复的 bug（[tech.md §7](references/tech.md#7-已知问题prefer-const-自动修复2026-10-212026-10-22-修订)）。`scripts/format.sh` 已经绕开；VS Code 保存时只修一遍，还会踩，手动改回。
- 通过命令行改的文件（`shadcn add`、`sed`、codegen）不会触发 PostToolUse hook，要么手动 `pnpm format`，要么等 pre-commit 钩子补上。
- pre-commit 钩子的问题（`Failed to restore unstaged changes!`、`--no-stash` 警告）见 [tech.md §9](references/tech.md#9-pre-commit-钩子2026-10-22)。

## 升级 oxlint / oxfmt

- oxfmt 还是 0.x，`^0.74.0` 只收 patch。升 minor 后跑一次 `pnpm format`，格式变化单独提交。
- 升级后 `prefer-const` 的 bug（[oxc#28003](https://github.com/oxc-project/oxc/issues/28003)）修好了：去掉 `scripts/format.sh` 第一遍的 `-A prefer-const -A no-var`，把 tech.md §7 改写成一行"oxlint x.y 起已修复"，编号保留。

## 开类型感知规则

先升 TypeScript 7（见 `toolchain` skill），再 `pnpm add -Dw oxlint-tsgolint`，`.oxlintrc.json` 设 `options.typeAware: true`。实测 oxlint 会从约 0.12 秒变成约 2 秒。用户 2026-10-21 决定先不开（[tech.md §3.4](references/tech.md#34-类型感知规则未开启)）。

## 关键决定

- 用 Oxlint + Oxfmt 整体替换 ESLint + Prettier，没选 Biome：规则名和 ESLint 一致，迁移近乎 1:1（用户委托选型，2026-10-21，见 [tech.md §1](references/tech.md#1-选型2026-10-21)）
- 只有一份根配置，子包不建配置、不留 `lint` 脚本；client 专属规则放 `apps/client/**` override（2026-10-21，见 [tech.md §2.1](references/tech.md#21-一份根配置)）
- 规则 = correctness 分类 + 其余 recommended 显式列出 + `curly: all`、`one-var: never`（后两条用户追加，见 [tech.md §3](references/tech.md#3-规则组成2026-10-212026-10-22-修订)）
- 格式化工具不改代码结构，所以 `pnpm format` = 两遍 `oxlint --fix` + `oxfmt`（用户要求"format 出来的也符合 lint"）；2026-10-22 收进 `scripts/format.sh`，`pnpm format`、hook、pre-commit 共用（code review 指出，用户要求修复，见 [tech.md §2.2](references/tech.md#22-命令)）
- 代码风格交给 hook，不写进 CLAUDE.md（用户确认，见 [tech.md §6.2](references/tech.md#62-claude-code-的-posttooluse-hook)）
- Kubb 生成的 `src/gen/**` 由 oxfmt 格式化，不能加进 oxfmt 的忽略列表（计划外发现，见 [tech.md §5](references/tech.md#5-生成文件2026-10-21)）
- 类型感知规则暂不开：要先升 TypeScript 7（用户拍板"先不加"，见 [tech.md §3.4](references/tech.md#34-类型感知规则未开启)）
- oxlint 1.89 的 `prefer-const` 自动修复会改坏多变量的 `let` 声明，已报给上游；`scripts/format.sh` 第一遍关掉 `prefer-const`、`no-var` 绕开它，遍数不变，编辑器保存时仍会踩（2026-10-22，见 [tech.md §7](references/tech.md#7-已知问题prefer-const-自动修复2026-10-212026-10-22-修订)）
- pre-commit 钩子用 lint-staged 对暂存文件跑 `scripts/format.sh`，只修复和格式化，不跑测试、不拦 lint 错误（code review 指出，用户要求修复，2026-10-22）；加 `--no-stash`，不往各 worktree 共用的 stash 列表写备份（用户决定，2026-10-23，见 [tech.md §9](references/tech.md#9-pre-commit-钩子2026-10-22)）
- `no-undef` 只对 `.js` / `.mjs` / `.cjs` 开：这些文件不经过 tsc；`simple-import-sort/exports` 没有替代，export 顺序不再检查（2026-10-22，见 [tech.md §3.1](references/tech.md#31-迁移时没对上的规则)）

## 参考资料

| 文件                                          | 内容                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tech.md](references/tech.md)                 | §1 选型（Oxc / Biome / 留 ESLint）；§2 根配置、三个命令、`scripts/format.sh` 的写法；§3 规则组成、迁移漏掉的规则（含 JS 文件的 `no-undef`）、React 规则、`curly` / `one-var`、类型感知；§4 oxfmt 选项、import 排序、Tailwind 排序；§5 生成文件和 Kubb；§6 VS Code 与 Claude hook；§7 `prefer-const` bug；§8 风险表；§9 pre-commit 钩子（lint-staged） |
| [plan.md](references/plan.md)                 | 模板的施工记录：2026-10-21 的 7 个阶段（替换、全仓库格式化、Kubb 回归、加 `curly` / `one-var`、format 一步到位、Claude hook、改写成模块文档）；2026-10-22 按 code review 修复（共用脚本、绕开 `prefer-const` bug、pre-commit、`no-undef`、文档更正）                                                                                                  |
| [verification.md](references/verification.md) | `pnpm lint` 的组成；端到端检查；12 条手动验收（埋违规代码、format、React 规则、hook、pre-commit 等）；2026-10-21 到 2026-10-23 的实测耗时、依赖变化和发现的问题                                                                                                                                                                                       |

## 相关

- `toolchain`：类型感知规则要 TypeScript 7，可行性调研在那里。
- `feature-docs`：`pnpm lint` 的最后一步 `pnpm docs:check`。
- `commit-workflow`：commitlint 管提交信息，和这里的代码检查互不相干；pre-commit 钩子归这里管。
