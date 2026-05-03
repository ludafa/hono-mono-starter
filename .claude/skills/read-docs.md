---
description: Read product feature docs and technical solution docs to build context about the project. Run this at the start of every conversation in a project derived from hono-mono-starter.
---

# Read Project Documentation

Read all documentation under `apps/docs/` to understand the current product features, technical solutions, and architecture decisions before doing other work.

## Steps

1. List files under `apps/docs/features/`, `apps/docs/solutions/`, and `apps/docs/decisions/` (the last two may be empty in a fresh template — that's fine).
2. Read each file and internalize the context — product behavior, design rationale, key files involved.
3. Also read any top-level markdown in `apps/docs/` (e.g. `architecture.md`, `environment.md`).
4. Briefly tell the user what you read so they know you're up to speed. If `apps/docs/` is empty, say so in one sentence and move on.

## Notes

- Read-only step. Do not modify docs here.
- If a doc references source files, note them but don't read them yet unless asked.
- Pay attention to trade-offs and decisions — they inform later implementation choices.
