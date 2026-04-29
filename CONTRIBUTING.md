# Contributing

Pixel Coding Companion is early. The project is split into small phases so contributors can work on one surface at a time.

## Local Setup

```bash
pnpm install
pnpm dev
```

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Contribution Style

- Keep changes focused.
- Prefer TypeScript types for cross-process contracts.
- Put Electron main-process behavior in `src/main`.
- Put React UI behavior in `src/renderer`.
- Avoid adding MCP tools that run arbitrary shell commands.
