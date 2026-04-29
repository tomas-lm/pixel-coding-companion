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

- Status: Done.
- Added project records with name, color, and description.
- Added terminal configs with name, kind, cwd, and command lists.
- Added running session records with status and metadata.
- Added native folder picker for adding projects.
- Added `Start Workspace` to launch all templates for the active project.
- Supported multiple terminal sessions without killing hidden sessions.
- Routed visible status and companion color by active project.
- Updated the project model so projects are logical workspaces that can span multiple terminal folders.
- Added JSON persistence for workspace configuration.
- Added UI to create/rename workspaces and add/edit configured terminals.

## Phase 2.1: UI Responsiveness

Goal: make workspace panels adjustable like an IDE layout.

- Status: Done.
- Added draggable horizontal resizing between the project rail, terminal panel, and companion panel.
- Added draggable vertical resizing for Projects, Configured terminals, and Running inside the project rail.
- Persisted layout sizes in the workspace JSON config.
- Added `View > Reset default` to restore the original layout sizes.
- Preserved the stacked responsive layout on narrower windows.

## Phase 3: Basic Agent State

Goal: detect useful state changes from managed CLI agent sessions.

- Keep terminal setup command-first and user-configured.
- Detect basic running, done, and error states from process lifecycle.
- Track session start, exit code, duration, and last activity.
- Surface state changes in the companion panel.
- Create the event foundation for future XP, companion evolution, and MCP messages.

## Phase 4: Pixel Companion

Goal: turn session state into a companion interface.

- Add companion profile data: species, level, XP, and visual stage.
- Add sprite states: idle, working, speaking, waiting_input, error.
- Color speech by active project.
- Show short agent messages from the active session.

## Phase 5: Persistence

Goal: survive app restarts.

- Upgrade JSON persistence to SQLite if the config/event model outgrows flat files.
- Store projects, terminal configs, sessions, settings, and session events.
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
