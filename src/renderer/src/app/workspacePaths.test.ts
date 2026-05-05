import { describe, expect, it } from 'vitest'
import {
  normalizeWorkspaceFolderPath,
  resolvePickFolderDefaultPath,
  workspaceDefaultFolderValidationMessage
} from './workspacePaths'

describe('workspacePaths', () => {
  it('normalizes trimming, backslashes, and trailing slashes', () => {
    expect(normalizeWorkspaceFolderPath('')).toBe('')
    expect(normalizeWorkspaceFolderPath('  /home/foo/  ')).toBe('/home/foo')
    expect(normalizeWorkspaceFolderPath('C:\\Users\\me\\')).toBe('C:/Users/me')
    expect(normalizeWorkspaceFolderPath('/')).toBe('/')
  })

  it('validates default folder only when non-empty', () => {
    expect(workspaceDefaultFolderValidationMessage('')).toBeNull()
    expect(workspaceDefaultFolderValidationMessage('/abs')).toBeNull()
    expect(workspaceDefaultFolderValidationMessage('//server/share')).toBeNull()
    expect(workspaceDefaultFolderValidationMessage('C:/x')).toBeNull()
    expect(workspaceDefaultFolderValidationMessage('relative')).toEqual(
      expect.stringContaining('absolute path')
    )
    expect(workspaceDefaultFolderValidationMessage('./here')).toEqual(
      expect.stringContaining('absolute path')
    )
  })

  it('resolves pick-folder default path from first usable absolute candidate', () => {
    expect(resolvePickFolderDefaultPath('', 'relative', '/good/sub')).toBe('/good/sub')
    expect(resolvePickFolderDefaultPath('/first', '/second')).toBe('/first')
    expect(resolvePickFolderDefaultPath('', 'bad')).toBeUndefined()
  })
})
