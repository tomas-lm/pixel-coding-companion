# Roadmap

## Phase 0: Project Base

Goal: create a clean public Electron + React + TypeScript repo.

- Status: Done.
- Scaffolded Electron app.
- Replaced template branding with project shell.
- Added initial docs and license.
- Published the public GitHub repository.
- Verified typecheck/build.

## Phase 1: Real Terminal

Goal: run a real local terminal inside the app.

- Status: Done.
- Added xterm.js.
- Added node-pty.
- Spawned the user's default shell from the Electron main process.
- Streamed PTY output to the renderer.
- Sent input from the renderer to the PTY.
- Added basic resize support through `ResizeObserver` and xterm's fit addon.
- Cleaned up the shell process when the window/app closes.

## Phase 2: Projects And Sessions

Goal: make the app useful for multiple work contexts.

- Add project records with name, color, and path.
- Add session records with command, status, and project ownership.
- Support multiple terminal sessions.
- Route visible status by active project color.

## Phase 3: Agent Presets

Goal: launch common coding agents as managed sessions.

- Add presets for Codex, Claude Code, shell, and custom commands.
- Store command history per project.
- Detect basic running, done, and error states.

## Phase 4: Pixel Companion

Goal: turn session state into a companion interface.

- Add sprite states: idle, working, speaking, waiting_input, error.
- Color speech by active project.
- Show short agent messages from the active session.

## Phase 5: Persistence

Goal: survive app restarts.

- Add SQLite.
- Store projects, sessions, settings, and session events.
- Restore last window layout and active project.

## Phase 6: Local MCP Server

Goal: let external agents inspect and control safe parts of the app.

- Expose allowlisted tools such as `list_sessions`, `start_session`, and `send_message`.
- Require explicit user approval for risky operations.
- Avoid arbitrary shell execution through MCP.

## Phase 7: Distribution

Goal: make the app easy to install from GitHub.

- Configure GitHub Actions.
- Build macOS release assets.
- Publish GitHub Releases.
- Add `install.sh`.
- Later: add Homebrew cask.
