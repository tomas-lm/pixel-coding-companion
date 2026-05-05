import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { CodeEditorCheckRequest, CodeEditorCheckResult, CodeEditorId } from '../shared/system'

const execFileAsync = promisify(execFile)

type ConcreteCodeEditorId = Exclude<CodeEditorId, 'auto'>

type CodeEditorDefinition = {
  command: string
  id: ConcreteCodeEditorId
  label: string
}

const CODE_EDITORS: Record<ConcreteCodeEditorId, CodeEditorDefinition> = {
  cursor: {
    command: 'cursor',
    id: 'cursor',
    label: 'Cursor'
  },
  vscode: {
    command: 'code',
    id: 'vscode',
    label: 'VS Code'
  }
}

const AUTO_EDITOR_ORDER: ConcreteCodeEditorId[] = ['cursor', 'vscode']

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

export function getCodeEditorLabel(editor: CodeEditorId): string {
  if (editor === 'auto') return 'Auto'

  return CODE_EDITORS[editor].label
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('/bin/zsh', ['-lc', `command -v -- ${shellQuote(command)}`])
    return true
  } catch {
    return false
  }
}

async function resolveCodeEditor(editor: CodeEditorId): Promise<CodeEditorDefinition | null> {
  if (editor !== 'auto') {
    const definition = CODE_EDITORS[editor]
    return (await commandExists(definition.command)) ? definition : null
  }

  for (const candidateEditor of AUTO_EDITOR_ORDER) {
    const definition = CODE_EDITORS[candidateEditor]
    if (await commandExists(definition.command)) return definition
  }

  return null
}

export async function checkCodeEditor(
  request: CodeEditorCheckRequest
): Promise<CodeEditorCheckResult> {
  const resolvedEditor = await resolveCodeEditor(request.editor)

  if (!resolvedEditor) {
    return {
      ok: false,
      editor: request.editor,
      label: getCodeEditorLabel(request.editor),
      reason: 'not_found'
    }
  }

  return {
    ok: true,
    command: resolvedEditor.command,
    editor: request.editor,
    label: request.editor === 'auto' ? `Auto (${resolvedEditor.label})` : resolvedEditor.label,
    resolvedEditor: resolvedEditor.id
  }
}

export async function openWithCodeEditor({
  column,
  editor,
  line,
  targetPath
}: {
  column?: number
  editor: CodeEditorId
  line?: number
  targetPath: string
}): Promise<boolean> {
  const resolvedEditor = await resolveCodeEditor(editor)
  if (!resolvedEditor) return false

  const targetArgument = line ? `${targetPath}:${line}:${column ?? 1}` : targetPath
  const commandArgs = line ? ['-g', targetArgument] : [targetArgument]
  const commandLine = [resolvedEditor.command, ...commandArgs].map(shellQuote).join(' ')

  try {
    const child = spawn('/bin/zsh', ['-lc', commandLine], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return true
  } catch {
    return false
  }
}
