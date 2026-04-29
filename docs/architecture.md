# Architecture

Pixel Coding Companion starts as a local-first macOS desktop app for coordinating coding agent sessions.

## Stack

- Desktop shell: Electron
- UI: React and TypeScript
- Build tooling: electron-vite and electron-builder
- Terminal renderer, phase 1: xterm.js
- Process runtime, phase 1: node-pty
- Persistence, later phase: SQLite
- MCP integration, later phase: local MCP server with allowlisted tools

## Process Boundaries

- `src/main`: owns Electron windows, OS integration, child processes, and future PTY sessions.
- `src/preload`: exposes a narrow, typed bridge from the main process to the renderer.
- `src/renderer`: owns the React interface, companion visuals, project navigation, and session views.
- `src/shared`, future: shared TypeScript types for projects, sessions, and events.

## Core Domain Model

```ts
type Project = {
  id: string
  name: string
  color: string
  path: string
}

type SessionStatus = 'idle' | 'running' | 'needs_input' | 'done' | 'error'

type Session = {
  id: string
  projectId: string
  title: string
  command: string
  status: SessionStatus
}
```

Phase 2 expands this into session templates and running sessions:

```ts
type SessionKind = 'ai' | 'shell' | 'dev_server' | 'logs' | 'test' | 'custom'

type SessionTemplate = {
  id: string
  projectId: string
  name: string
  kind: SessionKind
  command: string
  cwd: string
}

type RunningSession = {
  id: string
  projectId: string
  templateId: string
  name: string
  kind: SessionKind
  command: string
  cwd: string
  status: 'starting' | 'running' | 'exited' | 'error'
  metadata: string
}
```

## First Technical Spine

The app proves the terminal manager before adding agent intelligence:

1. Open one real shell through a PTY.
2. Render it through xterm.js.
3. Route input from React to the PTY.
4. Keep session state in the main process.
5. Add multiple project-bound sessions.

MCP should come after this spine works. It is useful as a control surface, but it should not be the app's first primitive.

## Terminal IPC

The renderer does not get direct Node access. It uses the preload bridge exposed at `window.api.terminal`.

Current channels:

- `terminal:start`
- `terminal:stop`
- `terminal:input`
- `terminal:resize`
- `terminal:data`
- `terminal:exit`

The Electron main process owns the `node-pty` process map. The React renderer owns only the xterm.js view and sends input/resize events through typed IPC.

## Workspace IPC

The renderer asks the main process to open native OS dialogs. It does not directly access filesystem APIs.

Current workspace channel:

- `workspace:pick-folder`

The folder picker returns the selected path and folder name. Persistence is intentionally not implemented yet; phase 2 keeps projects and sessions in memory while the interaction model settles.
