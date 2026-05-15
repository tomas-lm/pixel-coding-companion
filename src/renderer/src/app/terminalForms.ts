import type { SessionKind } from '../../../shared/workspace'

export type TerminalForm = {
  id?: string
  accentColor?: string
  name: string
  kind: SessionKind
  cwd: string
  commandsText: string
}

export function createEmptyTerminalForm(initialCwd = ''): TerminalForm {
  return {
    name: '',
    kind: 'ai',
    cwd: initialCwd,
    commandsText: ''
  }
}
