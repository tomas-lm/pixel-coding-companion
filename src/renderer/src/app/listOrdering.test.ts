import { describe, expect, it } from 'vitest'
import { reorderItemsByTargetIndex } from './listOrdering'

describe('reorderItemsByTargetIndex', () => {
  it('moves an item to the list end index', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    const reordered = reorderItemsByTargetIndex(items, 'a', items.length)

    expect(reordered.map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves item before requested insertion index', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

    const reordered = reorderItemsByTargetIndex(items, 'd', 1)

    expect(reordered.map((item) => item.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('returns original array when dragged id does not exist', () => {
    const items = [{ id: 'a' }, { id: 'b' }]

    const reordered = reorderItemsByTargetIndex(items, 'x', 1)

    expect(reordered).toBe(items)
  })
})
