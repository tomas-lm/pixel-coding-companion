export type IdentifiableItem = {
  id: string
}

export function reorderItemsByTargetIndex<T extends IdentifiableItem>(
  items: T[],
  draggedId: string,
  targetIndex: number
): T[] {
  const draggedIndex = items.findIndex((item) => item.id === draggedId)
  if (draggedIndex === -1) {
    return items
  }

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, items.length))
  const adjustedTargetIndex =
    draggedIndex < boundedTargetIndex ? boundedTargetIndex - 1 : boundedTargetIndex

  if (draggedIndex === adjustedTargetIndex) {
    return items
  }

  const nextItems = [...items]
  const [draggedItem] = nextItems.splice(draggedIndex, 1)
  nextItems.splice(adjustedTargetIndex, 0, draggedItem)
  return nextItems
}
