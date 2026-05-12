import { describe, expect, it } from 'vitest'
import {
  buildNoisyCommandHookResponse,
  classifyNoisyCommand,
  extractShellCommandFromHookInput,
  isPixelCompactCommand,
  splitShellCommand
} from './pixel-compact-rules.mjs'

describe('pixel compact command rules', () => {
  it('tokenizes simple quoted shell commands', () => {
    expect(splitShellCommand("npm run test -- --grep 'user flow'")).toEqual([
      'npm',
      'run',
      'test',
      '--',
      '--grep',
      'user flow'
    ])
  })

  it('matches noisy test commands', () => {
    expect(classifyNoisyCommand('npm test').category).toBe('test')
    expect(classifyNoisyCommand('pnpm run test -- --run').category).toBe('test')
    expect(classifyNoisyCommand('pytest tests/test_usage.py').category).toBe('test')
    expect(classifyNoisyCommand('playwright test').category).toBe('test')
    expect(classifyNoisyCommand('go test ./...').category).toBe('test')
    expect(classifyNoisyCommand('cargo test').category).toBe('test')
  })

  it('matches noisy listing and git commands', () => {
    expect(classifyNoisyCommand('find . -type f').category).toBe('listing')
    expect(classifyNoisyCommand('tree .').category).toBe('listing')
    expect(classifyNoisyCommand('ls -R').category).toBe('listing')
    expect(classifyNoisyCommand('ls -la').category).toBe('listing')
    expect(classifyNoisyCommand('git diff').category).toBe('git')
    expect(classifyNoisyCommand('git log --oneline').category).toBe('git')
  })

  it('ignores safe commands and already wrapped compact commands', () => {
    expect(classifyNoisyCommand('git status --short').matched).toBe(false)
    expect(classifyNoisyCommand('ls src/main').matched).toBe(false)
    expect(classifyNoisyCommand('npm install').matched).toBe(false)
    expect(classifyNoisyCommand('npm test | cat').matched).toBe(false)
    expect(classifyNoisyCommand('pixel run --compact -- npm test').matched).toBe(false)
    expect(isPixelCompactCommand('node /tmp/pixel.mjs run --compact -- npm test')).toBe(true)
  })

  it('extracts Bash commands from Claude and Codex-style hook input', () => {
    expect(
      extractShellCommandFromHookInput({
        tool_name: 'Bash',
        tool_input: { command: 'npm test' }
      })
    ).toBe('npm test')
    expect(
      extractShellCommandFromHookInput({
        tool: { name: 'shell', input: { command: 'git diff' } }
      })
    ).toBe('git diff')
    expect(
      extractShellCommandFromHookInput({
        tool_name: 'exec_command',
        tool_input: { cmd: 'git log --oneline' }
      })
    ).toBe('git log --oneline')
    expect(
      extractShellCommandFromHookInput({
        tool_name: 'functions.exec_command',
        arguments: JSON.stringify({ cmd: 'pnpm test' })
      })
    ).toBe('pnpm test')
    expect(
      extractShellCommandFromHookInput({
        tool: 'shell',
        input: 'git diff'
      })
    ).toBe('git diff')
    expect(
      extractShellCommandFromHookInput({
        tool_name: 'Read',
        tool_input: { file_path: 'README.md' }
      })
    ).toBeNull()
  })

  it('builds a hook-specific deny response for noisy shell commands', () => {
    const response = buildNoisyCommandHookResponse({
      tool_name: 'exec_command',
      tool_input: { cmd: 'npm test' }
    })

    expect(response).not.toHaveProperty('continue')
    expect(response).not.toHaveProperty('decision')
    expect(response.hookSpecificOutput.permissionDecision).toBe('deny')
    expect(response.hookSpecificOutput.permissionDecisionReason).toContain('pixel run --compact --')
  })

  it('returns an empty allow response for safe or unrelated hook input', () => {
    expect(
      buildNoisyCommandHookResponse({
        tool_name: 'Bash',
        tool_input: { command: 'git status --short' }
      })
    ).toEqual({})
    expect(
      buildNoisyCommandHookResponse({
        tool_name: 'Read',
        tool_input: { file_path: 'README.md' }
      })
    ).toEqual({})
  })
})
