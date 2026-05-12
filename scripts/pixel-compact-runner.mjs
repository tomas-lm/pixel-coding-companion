/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn } from 'node:child_process'
import { classifyNoisyCommand } from './pixel-compact-rules.mjs'
import { writeCompactLog } from './pixel-compact-logs.mjs'

const MAX_SNIPPET_LINES = 12

function trimLines(text, maxLines = MAX_SNIPPET_LINES) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  if (lines.length <= maxLines) return lines
  return [...lines.slice(0, maxLines), `... ${lines.length - maxLines} more lines omitted`]
}

function countPattern(text, pattern) {
  return Array.from(String(text ?? '').matchAll(pattern)).length
}

function summarizeTests({ command, exitCode, stdout, stderr, durationMs, rawOutputId }) {
  const combined = `${stdout}\n${stderr}`
  const failedLines = trimLines(
    combined
      .split(/\r?\n/)
      .filter((line) => /\b(fail|failed|error|expect|assert|✗|×)\b/i.test(line))
      .join('\n')
  )
  const passedCount =
    countPattern(combined, /\bpass(?:ed|es)?\b/gi) + countPattern(combined, /\b✓\b/g)
  const failedCount =
    countPattern(combined, /\bfail(?:ed|ures?)?\b/gi) + countPattern(combined, /\b✗|×\b/g)

  const lines = [
    'Pixel compact test summary',
    `Command: ${command}`,
    `Exit code: ${exitCode}`,
    `Duration: ${durationMs}ms`,
    `Raw output: ${rawOutputId}`
  ]

  if (passedCount || failedCount) {
    lines.push(`Detected result words: ${passedCount} pass / ${failedCount} fail`)
  }

  if (exitCode === 0) {
    lines.push('Result: command passed.')
  } else {
    lines.push('Result: command failed.')
  }

  if (failedLines.length > 0) {
    lines.push('', 'Key failure lines:', ...failedLines)
  } else {
    const snippet = trimLines(combined, 8)
    if (snippet.length > 0) lines.push('', 'Output snippet:', ...snippet)
  }

  lines.push('', `Inspect raw output: pixel logs show ${rawOutputId}`)
  return `${lines.join('\n')}\n`
}

function summarizeGit({ command, exitCode, stdout, stderr, durationMs, rawOutputId }) {
  const changedFiles = new Set()
  const combined = `${stdout}\n${stderr}`

  for (const line of combined.split(/\r?\n/)) {
    const diffMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
    if (diffMatch) {
      changedFiles.add(diffMatch[2])
      continue
    }

    const statusMatch =
      /^(?:\s*(?:modified|new file|deleted|renamed):\s+|[ MADRCU?!]{1,2}\s+)(.+)$/.exec(line)
    if (statusMatch) changedFiles.add(statusMatch[1].trim())
  }

  const files = Array.from(changedFiles)
  const lines = [
    'Pixel compact git summary',
    `Command: ${command}`,
    `Exit code: ${exitCode}`,
    `Duration: ${durationMs}ms`,
    `Raw output: ${rawOutputId}`
  ]

  if (files.length > 0) {
    lines.push(
      `Changed files detected: ${files.length}`,
      ...files.slice(0, 20).map((file) => `- ${file}`)
    )
    if (files.length > 20) lines.push(`- ... ${files.length - 20} more files omitted`)
  } else {
    lines.push('No changed files detected in compact parser output.')
  }

  lines.push('', `Inspect raw output: pixel logs show ${rawOutputId}`)
  return `${lines.join('\n')}\n`
}

function summarizeListing({ command, exitCode, stdout, stderr, durationMs, rawOutputId }) {
  const linesOut = String(stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  const stderrLines = trimLines(stderr, 6)
  const topGroups = new Map()

  for (const line of linesOut) {
    const normalized = line.replace(/^\.\//, '')
    const [first] = normalized.split(/[/:]/)
    if (!first) continue
    topGroups.set(first, (topGroups.get(first) ?? 0) + 1)
  }

  const groups = Array.from(topGroups.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  const lines = [
    'Pixel compact listing summary',
    `Command: ${command}`,
    `Exit code: ${exitCode}`,
    `Duration: ${durationMs}ms`,
    `Raw output: ${rawOutputId}`,
    `Output lines: ${linesOut.length}`
  ]

  if (groups.length > 0) {
    lines.push('Top groups:', ...groups.map(([group, count]) => `- ${group}: ${count}`))
  }

  if (stderrLines.length > 0) {
    lines.push('', 'stderr snippet:', ...stderrLines)
  }

  lines.push('', `Inspect raw output: pixel logs show ${rawOutputId}`)
  return `${lines.join('\n')}\n`
}

function summarizeGeneric({ command, exitCode, stdout, stderr, durationMs, rawOutputId }) {
  const combined = `${stdout}\n${stderr}`
  const snippet = trimLines(combined, 12)
  const lines = [
    'Pixel compact command summary',
    `Command: ${command}`,
    `Exit code: ${exitCode}`,
    `Duration: ${durationMs}ms`,
    `Raw output: ${rawOutputId}`
  ]

  if (snippet.length > 0) lines.push('', 'Output snippet:', ...snippet)

  lines.push('', `Inspect raw output: pixel logs show ${rawOutputId}`)
  return `${lines.join('\n')}\n`
}

export function summarizeCommandOutput({
  command,
  exitCode,
  stdout,
  stderr,
  durationMs,
  rawOutputId
}) {
  const classification = classifyNoisyCommand(command)

  if (classification.category === 'test') {
    return summarizeTests({ command, exitCode, stdout, stderr, durationMs, rawOutputId })
  }

  if (classification.category === 'git') {
    return summarizeGit({ command, exitCode, stdout, stderr, durationMs, rawOutputId })
  }

  if (classification.category === 'listing') {
    return summarizeListing({ command, exitCode, stdout, stderr, durationMs, rawOutputId })
  }

  return summarizeGeneric({ command, exitCode, stdout, stderr, durationMs, rawOutputId })
}

function collectStream(stream) {
  let output = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    output += chunk
  })

  return () => output
}

function extractLeadingEnv(commandArgs, baseEnv) {
  const runEnv = { ...baseEnv }
  const remainingArgs = [...commandArgs]

  while (remainingArgs.length > 0) {
    const [key, value] = String(remainingArgs[0]).split(/=(.*)/s)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value === undefined) break

    runEnv[key] = value
    remainingArgs.shift()
  }

  if (remainingArgs.length === 0) {
    throw new Error('pixel run --compact requires a command after environment assignments')
  }

  return {
    command: remainingArgs[0],
    args: remainingArgs.slice(1),
    env: runEnv
  }
}

export function runCompactCommand(
  commandArgs,
  { cwd = process.cwd(), dataDir, env = process.env } = {}
) {
  if (!Array.isArray(commandArgs) || commandArgs.length === 0) {
    throw new Error('pixel run --compact requires a command after --')
  }

  const { args, command, env: runEnv } = extractLeadingEnv(commandArgs, env)
  const commandText = commandArgs.join(' ')
  const startedAt = new Date().toISOString()
  const startedAtMs = Date.now()

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: runEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const getStdout = collectStream(child.stdout)
    const getStderr = collectStream(child.stderr)

    child.on('error', async (error) => {
      const endedAt = new Date().toISOString()
      const stderr = error.message
      const durationMs = Date.now() - startedAtMs
      const { id } = await writeCompactLog(
        {
          args,
          command: commandText,
          commandPath: command,
          cwd,
          endedAt,
          exitCode: 127,
          startedAt,
          stderr,
          stdout: ''
        },
        { dataDir }
      )

      resolve({
        exitCode: 127,
        rawOutputId: id,
        summary: summarizeCommandOutput({
          command: commandText,
          durationMs,
          exitCode: 127,
          rawOutputId: id,
          stderr,
          stdout: ''
        })
      })
    })

    child.on('close', async (exitCode) => {
      const endedAt = new Date().toISOString()
      const stdout = getStdout()
      const stderr = getStderr()
      const durationMs = Date.now() - startedAtMs
      const { id } = await writeCompactLog(
        {
          args,
          command: commandText,
          commandPath: command,
          cwd,
          endedAt,
          exitCode: exitCode ?? 0,
          startedAt,
          stderr,
          stdout
        },
        { dataDir }
      )

      resolve({
        exitCode: exitCode ?? 0,
        rawOutputId: id,
        summary: summarizeCommandOutput({
          command: commandText,
          durationMs,
          exitCode: exitCode ?? 0,
          rawOutputId: id,
          stderr,
          stdout
        })
      })
    })
  })
}
