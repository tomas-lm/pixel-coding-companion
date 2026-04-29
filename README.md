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
- multiple in-memory terminal sessions

The app can create projects from folders, start session templates, and keep multiple terminal sessions alive while switching between them.

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
