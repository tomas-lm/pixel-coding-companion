import { describe, expect, it } from 'vitest'
import { getPtyShellArgs } from './terminalManager'

describe('TerminalManager', () => {
  it('starts macOS zsh and bash as login shells', () => {
    expect(getPtyShellArgs('/bin/zsh', 'darwin')).toEqual(['--login'])
    expect(getPtyShellArgs('/opt/homebrew/bin/bash', 'darwin')).toEqual(['--login'])
  })

  it('does not add login shell args on Linux or Windows', () => {
    expect(getPtyShellArgs('/bin/zsh', 'linux')).toEqual([])
    expect(
      getPtyShellArgs('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'win32')
    ).toEqual([])
  })

  it('leaves unknown macOS shells unchanged', () => {
    expect(getPtyShellArgs('/opt/homebrew/bin/fish', 'darwin')).toEqual([])
  })
})
