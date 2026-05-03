# Project documentation

Living docs that survive across Claude Code sessions. Keep them concise (1–2 pages each) and reference source paths so readers can dive deeper.

## Layout

- **`features/<name>.md`** — what a feature does, user-facing behavior, configuration options
- **`solutions/<topic>.md`** — algorithms, data-flow designs, integration patterns
- **`decisions/NNNN-<title>.md`** — Architecture Decision Records (ADRs) explaining why we chose X over Y

## When to write

- New feature → create or update `features/<feature>.md`
- Non-trivial technical problem solved → create or update `solutions/<topic>.md`
- Significant design decision → create `decisions/NNNN-<title>.md`

Don't document trivial bug fixes or one-line changes — only features and solutions worth explaining.

## File template

```markdown
# Title

Brief one-line summary.

## Context / Problem

What motivated this.

## Solution / Design

How it works — enough detail for a new contributor to understand without reading every source file.

## Key Files

- `path/to/relevant/file.ts` — role

## Trade-offs / Alternatives Considered

(For decisions only) What we didn't pick and why.
```
