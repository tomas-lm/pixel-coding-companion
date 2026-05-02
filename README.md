# Pixel Companion

A local desktop companion for coordinating coding agent sessions across projects.

Pixel Companion is a macOS-first desktop app for developers who run several AI coding
terminals at the same time. It lets you group terminals by project, launch them from
configured folders, keep a shared companion transcript on the side, and let **Ghou**,
the built-in pixel companion, report when agent work starts, finishes, fails, or needs
input.

The project is currently an alpha/dev build distributed from GitHub. Expect to clone
the repo, run it locally, and configure your agent tools manually.

## What It Does

- Group terminal sessions by logical project.
- Configure project terminals with folders, categories, and command lists.
- Start all project terminals or only selected terminal categories.
- Run AI terminals with an optional Ghou startup instruction.
- Display companion messages from Codex/Claude-style agents through a local MCP bridge.
- Track Ghou's local XP and level progress.
- Use draggable layout panels and selectable terminal themes.

## Product Rules

Ghou is part of the product, not a user setting.

The companion name, personality, voice, XP formula, XP caps, and evolution rules are
fixed in the codebase. Users configure projects and terminals; they do not configure
the companion's identity or progression model.

The current XP system is local and intended for the alpha experience. Future versions
may add account-backed progression, request caps, server validation, and other integrity
checks so higher-level companions feel harder to fake.

## Requirements

- macOS for the primary supported experience.
- Node.js 22 or newer.
- pnpm.
- A local AI CLI such as Codex, Claude Code, Cursor CLI, or another terminal-based agent.

## Local Development

```bash
git clone https://github.com/tomas-lm/pixel-coding-companion.git
cd pixel-coding-companion
pnpm install
pnpm dev
```

The app stores local workspace and companion data in the OS application data directory.
On macOS, that is usually:

```text
~/Library/Application Support/pixel-coding-companion
```

### Stable Work Window Plus Dev Window

When developing Pixel Companion while also using it for real project work, keep the
compiled app as the stable work window and run development with an isolated profile:

```bash
pnpm build:unpack
pnpm open:stable
pnpm dev:isolated
```

`pnpm open:stable` opens the compiled app from `dist/mac-arm64` and does not stop any
running development window. `pnpm dev:isolated` starts the dev app as `Pixel Companion
Dev` with its own data directory:

```text
~/Library/Application Support/pixel-coding-companion-dev
```

Use the stable window for company/project terminals and the isolated dev window for
Pixel Companion development. Avoid broad process kills; stop only the dev terminal
session when you want the dev app to close.

## Basic App Setup

1. Start the app with `pnpm dev`.
2. Create a project from the left panel.
3. Add configured terminals for that project.
4. Set each terminal folder and command.
5. Mark AI agent terminals as `AI`.
6. Click `Start Project`.
7. Keep `Start with Pixel` enabled for selected Codex terminals.

Example project layout:

```text
ProjectX
- Assistant: /Users/you/dev
- Backend: /Users/you/dev/company/ProjectX
- Frontend: /Users/you/dev/company/ProjectX-frontend
```

Each project owns its configured terminals, even if multiple projects reuse the same
folder. This keeps `/dev` assistant terminals separate across projects.

## Pixel Codex Launcher

For Codex terminals, set the configured terminal command to `codex` or any normal
Codex command such as:

```bash
codex --yolo
```

When `Start with Pixel` is enabled, Pixel Companion automatically launches that as:

```bash
pixel codex --yolo
```

Inside the app, Pixel resolves this to the local launcher script. For manual shell usage
from this repo, expose the `pixel` command with:

```bash
pnpm link
pixel codex
```

`pixel codex` installs and refreshes the Codex hook configuration before launching
Codex:

- enables `codex_hooks = true` in `~/.codex/config.toml`;
- writes Pixel Companion hooks to `~/.codex/hooks.json`;
- injects Ghou's companion contract on Codex startup, resume, and `/clear`;
- records prompt start/finish events so Ghou can receive XP even when the MCP report is
  missed.

The hooks are a fallback and lifecycle layer. The MCP bridge below is still what gives
Ghou the best natural-language updates.

## Codex MCP Setup

Pixel Companion includes a local stdio MCP server:

```bash
pnpm mcp
```

For Codex, add the MCP server to your Codex config file:

```toml
[mcp_servers.pixel-companion]
command = "node"
args = ["/absolute/path/to/pixel-coding-companion/scripts/pixel-companion-mcp.mjs"]

[mcp_servers.pixel-companion.tools.companion_report]
approval_mode = "approve"
```

Replace `/absolute/path/to/pixel-coding-companion` with your local clone path.

After restarting Codex, the `pixel-companion` MCP server should expose these tools:

- `companion_report`
- `companion_get_profile`
- `companion_get_state`
- `companion_list_projects`

## Agent Reporting Contract

When an AI agent is running inside a Pixel Companion terminal, it should use the MCP
bridge like this:

- Call `companion_get_profile` after a context reset, `/clear`, or whenever the agent is
  unsure how Ghou should speak.
- Call `companion_report` when meaningful work starts, finishes, fails, or needs user
  input.
- Write Ghou messages as natural user-facing speech.
- Match the user's language and communication style.
- Mention concrete results, blockers, errors, or next steps.
- Avoid audit-log phrasing such as `Task completed`, `Status updated`, or
  `companion_report was called`.
- Do not mention MCP or tool calls unless the user is debugging Pixel Companion itself.

The app's `Start with Pixel` option no longer pastes this contract as a prompt. For
Codex, it launches through `pixel codex`, then Codex hooks provide the contract as
startup context and restore it after `/clear`.

## Manual Startup Instruction

If you are using another CLI that is not wrapped by Pixel yet, paste this at the start of
the agent session:

```text
[Pixel Companion setup] This is a startup instruction, not a user task. You are running inside a Pixel Companion terminal. The active companion is Ghou: a calm, observant pixel ghost with lightly playful humor and concise, useful speech. Use the pixel-companion MCP companion_report tool when meaningful work starts, finishes, fails, or needs user input. If context is reset or cleared, use companion_get_profile to recover the active companion personality and reporting contract. Write Ghou messages as natural user-facing speech, matching the user language and style without assuming a specific locale. Do not mention MCP/tool calls unless the user is debugging Pixel Companion itself.
```

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm build:mac
```

## Project Docs

- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Companion Sprite Strategy](docs/companion-sprites.md)
- [Security](docs/security.md)

## Security Notes

Pixel Companion can launch local commands and exposes a local MCP bridge. Treat both as
privileged local capabilities:

- Only configure terminals you understand.
- Keep MCP tools scoped to companion reporting and allowlisted app actions.
- Do not expose arbitrary shell execution through MCP.
- Review [docs/security.md](docs/security.md) before adding new command or MCP features.

## License

MIT
