/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { shellQuote } from './pixel-compact-rules.mjs'

export const PIXEL_HOOK_SCRIPT_MARKER = 'pixel-companion-hook.mjs'
export const CODEX_SHELL_TOOL_MATCHER = 'Bash'

export function ensureCodexHooksFeature(contents) {
  const normalizedContents = contents.replace(/\r\n/g, '\n')
  const lines = normalizedContents.split('\n')
  const featuresIndex = lines.findIndex((line) => /^\s*\[features\]\s*$/.test(line))

  if (featuresIndex === -1) {
    const prefix = normalizedContents.trim().length > 0 ? `${normalizedContents.trimEnd()}\n\n` : ''
    return `${prefix}[features]\ncodex_hooks = true\n`
  }

  let sectionEndIndex = lines.length
  for (let index = featuresIndex + 1; index < lines.length; index += 1) {
    if (/^\s*\[.*\]\s*$/.test(lines[index])) {
      sectionEndIndex = index
      break
    }
  }

  const flagIndex = lines.findIndex(
    (line, index) =>
      index > featuresIndex && index < sectionEndIndex && /^\s*codex_hooks\s*=/.test(line)
  )

  if (flagIndex === -1) {
    lines.splice(featuresIndex + 1, 0, 'codex_hooks = true')
  } else {
    lines[flagIndex] = 'codex_hooks = true'
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function createHookCommand(hookScriptPath, command) {
  return `node ${shellQuote(hookScriptPath)} ${command}`
}

export function removePixelHookHandlers(eventGroups) {
  return eventGroups
    .map((group) => {
      const hooks = Array.isArray(group?.hooks)
        ? group.hooks.filter(
            (hook) =>
              !(
                hook &&
                typeof hook.command === 'string' &&
                hook.command.includes(PIXEL_HOOK_SCRIPT_MARKER)
              )
          )
        : []

      return {
        ...group,
        hooks
      }
    })
    .filter((group) => group.hooks.length > 0)
}

export function upsertPixelHook(hooksConfig, eventName, group) {
  const hooks = hooksConfig.hooks && typeof hooksConfig.hooks === 'object' ? hooksConfig.hooks : {}
  const currentGroups = Array.isArray(hooks[eventName]) ? hooks[eventName] : []

  return {
    ...hooksConfig,
    hooks: {
      ...hooks,
      [eventName]: [...removePixelHookHandlers(currentGroups), group]
    }
  }
}

function hookGroup(command, matcher, statusMessage) {
  return {
    ...(matcher ? { matcher } : {}),
    hooks: [
      {
        type: 'command',
        command,
        timeout: 10,
        statusMessage
      }
    ]
  }
}

export function applyCodexPixelHooks(hooksConfig, hookScriptPath) {
  const command = (eventName) => createHookCommand(hookScriptPath, `codex-${eventName}`)
  let nextConfig = hooksConfig

  nextConfig = upsertPixelHook(
    nextConfig,
    'SessionStart',
    hookGroup(command('session-start'), 'startup|resume|clear', 'Loading Pixel Companion context')
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'UserPromptSubmit',
    hookGroup(command('user-prompt-submit'), undefined, 'Notifying Pixel Companion')
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'PreToolUse',
    hookGroup(
      command('pre-tool-use'),
      CODEX_SHELL_TOOL_MATCHER,
      'Checking Pixel compact-output rules'
    )
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'Stop',
    hookGroup(command('stop'), undefined, 'Updating Pixel Companion')
  )

  return nextConfig
}

export function applyClaudePixelHooks(settingsConfig, hookScriptPath) {
  const command = (eventName) => createHookCommand(hookScriptPath, `claude-${eventName}`)
  let nextConfig = settingsConfig

  nextConfig = upsertPixelHook(
    nextConfig,
    'SessionStart',
    hookGroup(
      command('session-start'),
      'startup|resume|clear|compact',
      'Loading Pixel Companion context'
    )
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'UserPromptSubmit',
    hookGroup(command('user-prompt-submit'), undefined, 'Notifying Pixel Companion')
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'PreToolUse',
    hookGroup(command('pre-tool-use'), 'Bash', 'Checking Pixel compact-output rules')
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'Stop',
    hookGroup(command('stop'), undefined, 'Updating Pixel Companion')
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'StopFailure',
    hookGroup(command('stop-failure'), undefined, 'Updating Pixel Companion')
  )
  nextConfig = upsertPixelHook(
    nextConfig,
    'Notification',
    hookGroup(
      command('notification'),
      'permission_prompt|idle_prompt|elicitation_dialog',
      'Updating Pixel Companion'
    )
  )

  return nextConfig
}
