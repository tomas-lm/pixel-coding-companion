# Security Notes

This app will eventually run local commands and expose an MCP control surface. Treat both as privileged.

## Initial Rules

- Do not expose arbitrary shell execution through MCP.
- Keep command presets explicit and editable by the user.
- Store logs locally.
- Do not upload terminal output by default.
- Redact obvious secrets before writing structured logs.
- Keep the renderer bridge narrow; avoid exposing Node APIs directly to React.

## MCP Rules

Future MCP tools should be allowlisted and scoped:

- `list_projects`
- `list_sessions`
- `start_session`
- `send_message`
- `get_session_output`
- `set_active_project`

Anything that can change files, run a new command, or read broad filesystem data should require explicit user approval.
