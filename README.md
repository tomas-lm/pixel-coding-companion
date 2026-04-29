# Pixel Coding Companion

A local desktop companion for coordinating coding agent sessions across projects.

The first target is macOS: a small pixel companion that lives on a second screen, watches local Codex/Claude Code/terminal sessions, shows which project is speaking, and routes replies back to the right terminal.

## Status

Phase 2 is the first workspace-manager version:

- Electron
- React
- TypeScript
- electron-vite
- electron-builder
- xterm.js
- node-pty
- project/session domain types
- native folder picker
- JSON workspace persistence
- configurable terminal commands

The app treats projects as logical workspaces. A workspace can launch several configured terminal sessions across different folders, so contexts like Engelmig and BAMAQ can each own their own assistant/backend/frontend terminals. Custom workspaces can be created by name, then filled with configurable terminals, folders, and command lists.

## Local Development

```bash
pnpm install
pnpm dev
```

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm build:mac
```

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Security

The app will eventually run local commands and expose a local MCP server. See [docs/security.md](docs/security.md) before adding command execution or MCP tools.

## License

MIT
