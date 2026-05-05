import { describe, expect, it } from 'vitest'
import {
  findMarkdownLinks,
  findTaskMarkers,
  findWikiLinks,
  shouldRenderDecoratedRange
} from './markdownRenderers'

describe('markdownRenderers helpers', () => {
  it('finds task markers on a line', () => {
    expect(findTaskMarkers('- [ ] Todo\n', 10)).toEqual([
      {
        checked: false,
        from: 12,
        to: 15
      }
    ])

    expect(findTaskMarkers('- [x] Done', 0)[0]?.checked).toBe(true)
  })

  it('finds markdown links and images', () => {
    expect(findMarkdownLinks('[Note](note.md) ![Alt](a.png)', 0)).toMatchObject([
      { href: 'note.md', image: false, label: 'Note' },
      { href: 'a.png', image: true, label: 'Alt' }
    ])
  })

  it('finds wiki links with aliases', () => {
    expect(findWikiLinks('[[Roadmap|Plan]]', 4)).toEqual([
      {
        from: 4,
        label: 'Plan',
        target: 'Roadmap',
        to: 20
      }
    ])
  })

  it('keeps syntax visible while selection is inside a decorated range', () => {
    expect(shouldRenderDecoratedRange([{ empty: true, from: 5, to: 5 }], 0, 10)).toBe(false)
    expect(shouldRenderDecoratedRange([{ empty: true, from: 12, to: 12 }], 0, 10)).toBe(true)
  })
})
