import { describe, expect, it } from 'vitest'
import { getPtyShellArgs } from './terminalManager'

describe('TerminalManager', () => {
  it('starts zsh and bash as login shells on macOS and Linux', () => {
    expect(getPtyShellArgs('/bin/zsh', 'darwin')).toEqual(['--login'])
    expect(getPtyShellArgs('/opt/homebrew/bin/bash', 'darwin')).toEqual(['--login'])
    expect(getPtyShellArgs('/bin/zsh', 'linux')).toEqual(['--login'])
    expect(getPtyShellArgs('/usr/bin/bash', 'linux')).toEqual(['--login'])
  })

  it('does not add login shell args on Windows', () => {
    expect(
      getPtyShellArgs('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'win32')
    ).toEqual([])
  })

  it('leaves fish and other shells unchanged', () => {
    expect(getPtyShellArgs('/opt/homebrew/bin/fish', 'darwin')).toEqual([])
    expect(getPtyShellArgs('/usr/bin/fish', 'linux')).toEqual([])
  })
})
