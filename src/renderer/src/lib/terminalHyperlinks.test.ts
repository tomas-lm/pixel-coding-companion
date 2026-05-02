import { describe, expect, it } from 'vitest'
import { getOpenTargetRequestFromHyperlink } from './terminalHyperlinks'

describe('terminalHyperlinks', () => {
  it('opens http and https links as external URLs', () => {
    expect(getOpenTargetRequestFromHyperlink('https://example.com')).toEqual({
      kind: 'external_url',
      url: 'https://example.com'
    })
  })

  it('opens file URLs explicitly', () => {
    expect(getOpenTargetRequestFromHyperlink('file:///tmp/report.txt')).toEqual({
      kind: 'file_url',
      url: 'file:///tmp/report.txt'
    })
  })

  it('opens path-like text relative to cwd', () => {
    expect(getOpenTargetRequestFromHyperlink('./src/App.tsx', '/workspace')).toEqual({
      cwd: '/workspace',
      kind: 'file_path',
      path: './src/App.tsx'
    })
  })

  it('rejects unsupported protocols and plain text', () => {
    expect(getOpenTargetRequestFromHyperlink('mailto:test@example.com')).toBeNull()
    expect(getOpenTargetRequestFromHyperlink('not a link')).toBeNull()
  })
})
