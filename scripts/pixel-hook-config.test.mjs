import { describe, expect, it } from 'vitest'
import {
  applyClaudePixelHooks,
  applyCodexPixelHooks,
  ensureCodexHooksFeature
} from './pixel-hook-config.mjs'

describe('pixel hook config', () => {
  it('enables the Codex hooks feature without clobbering other settings', () => {
    expect(ensureCodexHooksFeature('model = "gpt-5.5"\n')).toContain(
      '[features]\ncodex_hooks = true'
    )
    expect(ensureCodexHooksFeature('[features]\ncodex_hooks = false\n')).toBe(
      '[features]\ncodex_hooks = true\n'
    )
  })

  it('adds Codex filter hooks while preserving non-Pixel hooks and avoiding duplicates', () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo user-hook' }]
          },
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'node /old/pixel-companion-hook.mjs codex-old' }]
          }
        ]
      }
    }

    const next = applyCodexPixelHooks(existing, '/repo/scripts/pixel-companion-hook.mjs')

    expect(next.hooks.PreToolUse).toHaveLength(2)
    expect(next.hooks.PreToolUse[0].hooks[0].command).toBe('echo user-hook')
    expect(next.hooks.PreToolUse[1].hooks[0].command).toContain('codex-pre-tool-use')
  })

  it('adds Claude filter hooks while preserving non-Pixel hooks and avoiding duplicates', () => {
    const existing = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo user-hook' }]
          },
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'node /old/pixel-companion-hook.mjs claude-old' }]
          }
        ]
      }
    }

    const next = applyClaudePixelHooks(existing, '/repo/scripts/pixel-companion-hook.mjs')

    expect(next.hooks.PreToolUse).toHaveLength(2)
    expect(next.hooks.PreToolUse[0].hooks[0].command).toBe('echo user-hook')
    expect(next.hooks.PreToolUse[1].hooks[0].command).toContain('claude-pre-tool-use')
  })
})
