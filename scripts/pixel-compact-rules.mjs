/* eslint-disable @typescript-eslint/explicit-function-return-type */

const SHELL_OPERATOR_PATTERN = /(?:^|[\s;&|()<>])(?:&&|\|\||[;|()<>])(?:$|\s)/
const SHELL_TOOL_NAME_PATTERN = /^(?:bash|shell|terminal|exec_command|functions\.exec_command)$/i

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

export function splitShellCommand(command) {
  const tokens = []
  let current = ''
  let quote = null
  let escaped = false

  for (const char of String(command ?? '')) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escaped) current += '\\'
  if (current) tokens.push(current)

  return tokens
}

function stripEnvironmentAssignments(tokens) {
  let index = 0
  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) {
    index += 1
  }

  return tokens.slice(index)
}

export function isPixelCompactCommand(commandOrTokens) {
  const tokens = Array.isArray(commandOrTokens)
    ? commandOrTokens
    : splitShellCommand(commandOrTokens)
  const normalizedTokens = stripEnvironmentAssignments(tokens)

  if (normalizedTokens[0] === 'pixel') {
    return normalizedTokens[1] === 'run' && normalizedTokens.includes('--compact')
  }

  if (
    normalizedTokens[0] === 'node' &&
    normalizedTokens[1]?.endsWith('pixel.mjs') &&
    normalizedTokens[2] === 'run'
  ) {
    return normalizedTokens.includes('--compact')
  }

  return false
}

function hasShellOperators(command) {
  return SHELL_OPERATOR_PATTERN.test(String(command ?? ''))
}

function classifyTokens(tokens) {
  const [program, firstArg, secondArg] = tokens

  if (!program) return null

  if (program === 'npm' && (firstArg === 'test' || (firstArg === 'run' && secondArg === 'test'))) {
    return { category: 'test', reason: 'npm test output is often large' }
  }

  if (
    (program === 'pnpm' || program === 'yarn') &&
    (firstArg === 'test' || (firstArg === 'run' && secondArg === 'test'))
  ) {
    return { category: 'test', reason: `${program} test output is often large` }
  }

  if (['vitest', 'jest', 'pytest'].includes(program)) {
    return { category: 'test', reason: `${program} output is often large` }
  }

  if (program === 'playwright' && firstArg === 'test') {
    return { category: 'test', reason: 'Playwright output can include long traces and reports' }
  }

  if (program === 'go' && firstArg === 'test') {
    return { category: 'test', reason: 'go test output can be noisy' }
  }

  if (program === 'cargo' && firstArg === 'test') {
    return { category: 'test', reason: 'cargo test output can be noisy' }
  }

  if (program === 'find' || program === 'tree') {
    return { category: 'listing', reason: `${program} can emit very large directory listings` }
  }

  if (program === 'ls') {
    const optionArgs = tokens.filter((token) => token.startsWith('-'))
    const hasRecursive = optionArgs.some((token) => token.includes('R'))
    const hasLongAll = optionArgs.some((token) => token.includes('l') && token.includes('a'))
    const pathArgs = tokens.slice(1).filter((token) => !token.startsWith('-'))

    if (hasRecursive) {
      return { category: 'listing', reason: 'recursive ls output can be very large' }
    }

    if (hasLongAll && pathArgs.length === 0) {
      return { category: 'listing', reason: 'broad ls -la output can be noisy' }
    }
  }

  if (program === 'git') {
    if (firstArg === 'diff' || firstArg === 'log') {
      return { category: 'git', reason: `git ${firstArg} can dump a lot of text` }
    }

    if (firstArg === 'status' && secondArg !== '--short' && secondArg !== '-s') {
      return { category: 'git', reason: 'broad git status output can be compacted' }
    }
  }

  return null
}

export function classifyNoisyCommand(command) {
  const trimmedCommand = String(command ?? '').trim()
  if (!trimmedCommand || hasShellOperators(trimmedCommand)) {
    return {
      matched: false,
      command: trimmedCommand
    }
  }

  const tokens = stripEnvironmentAssignments(splitShellCommand(trimmedCommand))
  if (isPixelCompactCommand(tokens)) {
    return {
      matched: false,
      alreadyWrapped: true,
      command: trimmedCommand
    }
  }

  const match = classifyTokens(tokens)
  if (!match) {
    return {
      matched: false,
      command: trimmedCommand
    }
  }

  return {
    matched: true,
    category: match.category,
    command: trimmedCommand,
    reason: match.reason,
    rerunCommand: buildCompactRerunCommand(trimmedCommand),
    tokens
  }
}

export function buildCompactRerunCommand(command) {
  const tokens = splitShellCommand(command)
  return `pixel run --compact -- ${tokens.map(shellQuote).join(' ')}`
}

function parseJsonObject(value) {
  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function extractCommandFromCandidate(candidate, allowRawString = false) {
  if (!candidate) return null

  if (typeof candidate === 'string') {
    const parsed = parseJsonObject(candidate)
    if (parsed) return extractCommandFromCandidate(parsed, allowRawString)
    return allowRawString && candidate.trim() ? candidate.trim() : null
  }

  if (typeof candidate !== 'object') return null

  const command =
    candidate.command ??
    candidate.cmd ??
    candidate.bash_command ??
    candidate.shell_command ??
    candidate.script

  if (typeof command === 'string' && command.trim()) return command.trim()

  return null
}

export function extractShellCommandFromHookInput(hookInput) {
  const toolName =
    hookInput?.tool_name ??
    hookInput?.toolName ??
    (typeof hookInput?.tool === 'string' ? hookInput.tool : undefined) ??
    hookInput?.tool?.name ??
    hookInput?.tool?.tool_name ??
    hookInput?.tool_call?.name ??
    hookInput?.name

  if (toolName && !SHELL_TOOL_NAME_PATTERN.test(String(toolName))) {
    return null
  }

  const toolInputCandidates = [
    hookInput?.tool_input,
    hookInput?.toolInput,
    hookInput?.input,
    hookInput?.tool?.input,
    hookInput?.tool_call?.input,
    hookInput?.arguments,
    hookInput?.args,
    hookInput?.params,
    hookInput?.parameters,
    hookInput?.tool?.arguments,
    hookInput?.tool_call?.arguments
  ]

  for (const candidate of toolInputCandidates) {
    const command = extractCommandFromCandidate(candidate, Boolean(toolName))
    if (command) return command
  }

  return extractCommandFromCandidate(hookInput)
}

export function buildNoisyCommandHookResponse(hookInput) {
  const command = extractShellCommandFromHookInput(hookInput)
  if (!command) {
    return {
      continue: true
    }
  }

  const classification = classifyNoisyCommand(command)
  if (!classification.matched) {
    return {
      continue: true
    }
  }

  const message = [
    `Pixel compact-output filter blocked a noisy ${classification.category} command before it entered agent context.`,
    `Rerun it through Pixel instead: ${classification.rerunCommand}`,
    'The compact runner preserves the original exit code and stores the raw output for later inspection.'
  ].join(' ')

  return {
    continue: true,
    decision: 'block',
    reason: message,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message
    }
  }
}
