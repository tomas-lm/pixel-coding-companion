import { describe, expect, it } from 'vitest'
import { createEmptyTerminalForm } from './terminalForms'

describe('terminal forms', () => {
  it('creates the default terminal form for new AI terminals', () => {
    expect(createEmptyTerminalForm()).toEqual({
      commandsText: '',
      cwd: '',
      kind: 'ai',
      name: ''
    })
  })

  it('prefills cwd from initialCwd', () => {
    expect(createEmptyTerminalForm('/repo/workspace')).toEqual({
      commandsText: '',
      cwd: '/repo/workspace',
      kind: 'ai',
      name: ''
    })
  })
})
