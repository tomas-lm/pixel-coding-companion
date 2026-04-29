# Pixel Coding Companion

A local desktop companion for coordinating coding agent sessions across projects.

The first target is macOS: a small pixel companion that lives on a second screen, watches local Codex/Claude Code/terminal sessions, shows which project is speaking, and routes replies back to the right terminal.

## Status

Phase 0 is the project base:

- Electron
- React
- TypeScript
- electron-vite
- electron-builder

The next milestone is a real terminal pane using xterm.js and node-pty.

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
