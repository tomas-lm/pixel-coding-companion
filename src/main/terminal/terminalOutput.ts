export const COMMAND_EXIT_MARKER = '__PIXEL_COMPANION_COMMAND_EXIT__:'
export const COMMAND_EXIT_COMMAND = `printf '\\n${COMMAND_EXIT_MARKER}%s\\n' "$?"`
export const COMMAND_EXIT_PATTERN = new RegExp(
  `(?:\\r?\\n)?${COMMAND_EXIT_MARKER}(-?\\d+)(?:\\r?\\n)?`,
  'g'
)

const TERMINAL_OUTPUT_BUFFER_MAX_LENGTH = 250_000
const ANSI_SEQUENCE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')
const CODEX_CLI_READY_PATTERNS = [/Tip: Use \/skills/i, /›\s*$/]
const BENIGN_MALLOC_STACK_LOGGING_PATTERN =
  /^[^\r\n]*\(\d+\) MallocStackLogging: can't turn off malloc stack logging because it was not enabled\.\r?\n?/gm

export function getMarkerPrefixLength(data: string): number {
  const maxLength = Math.min(COMMAND_EXIT_MARKER.length - 1, data.length)

  for (let length = maxLength; length > 0; length -= 1) {
    if (COMMAND_EXIT_MARKER.startsWith(data.slice(-length))) return length
  }

  return 0
}

export function appendTerminalOutputBuffer(
  currentBuffer: string,
  data: string,
  maxLength = TERMINAL_OUTPUT_BUFFER_MAX_LENGTH
): string {
  if (!data) return currentBuffer

  return `${currentBuffer}${data}`.slice(-maxLength)
}

export function stripAnsiSequences(output: string): string {
  return output.replace(ANSI_SEQUENCE_PATTERN, '')
}

export function stripBenignMacOsMallocStackLogging(output: string): string {
  return output.replace(BENIGN_MALLOC_STACK_LOGGING_PATTERN, '')
}

export function isCodexCliReady(output: string): boolean {
  const plainOutput = stripAnsiSequences(output)
  return CODEX_CLI_READY_PATTERNS.some((pattern) => pattern.test(plainOutput))
}
