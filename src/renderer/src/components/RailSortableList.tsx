import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DraggableAttributes,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type Identifiable = {
  id: string
}

type SortableRenderArgs = {
  attributes: DraggableAttributes
  listeners: Record<string, unknown> | undefined
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
}

type RailSortableListProps<T extends Identifiable> = {
  className: string
  items: T[]
  onDragStateChange?: (isDragging: boolean) => void
  onReorder: (draggedId: string, targetIndex: number) => void
  renderItem: (item: T, index: number, args: SortableRenderArgs) => ReactNode
}

type SortableRowProps = {
  id: string
  children: (args: SortableRenderArgs) => ReactNode
}

function SortableRow({ id, children }: SortableRowProps): ReactNode {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  return children({
    attributes,
    listeners,
    setNodeRef,
    style: {
      transform: CSS.Transform.toString(transform),
      transition
    }
  })
}

function getClientY(event: DragMoveEvent['activatorEvent'] | null | undefined): number | null {
  if (!event) return null
  if (event instanceof MouseEvent) {
    return event.clientY
  }
  if (event instanceof TouchEvent && event.touches.length > 0) {
    return event.touches[0].clientY
  }
  return null
}

function getClosestScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
  let current: HTMLElement | null = element

  while (current && current.parentElement) {
    current = current.parentElement
    const style = window.getComputedStyle(current)
    const isScrollableY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    if (isScrollableY) {
      return current
    }
  }

  return null
}

export function RailSortableList<T extends Identifiable>({
  className,
  items,
  onDragStateChange,
  onReorder,
  renderItem
}: RailSortableListProps<T>): ReactNode {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }))
  const itemIds = useMemo(() => items.map((item) => item.id), [items])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollTargetRef = useRef<HTMLElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const pointerYRef = useRef<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    onDragStateChange?.(Boolean(activeId))
  }, [activeId, onDragStateChange])

  useEffect(() => {
    if (!activeId) return
    const scrollTarget = scrollTargetRef.current
    if (!scrollTarget) return

    const handleWheel = (event: WheelEvent): void => {
      const scaledDelta = Math.max(-28, Math.min(28, event.deltaY * 0.35))
      scrollTarget.scrollTop += scaledDelta
      event.preventDefault()
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [activeId])

  useEffect(() => {
    if (!activeId) return

    const handlePointerMove = (event: PointerEvent): void => {
      pointerYRef.current = event.clientY
    }
    const handleTouchMove = (event: TouchEvent): void => {
      if (event.touches.length > 0) {
        pointerYRef.current = event.touches[0].clientY
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    const scrollTarget = scrollTargetRef.current
    if (!scrollTarget) return

    const edgeThreshold = 58
    const maxStep = 20

    const tick = (): void => {
      const pointerY = pointerYRef.current
      if (pointerY !== null) {
        const rect = scrollTarget.getBoundingClientRect()
        let delta = 0

        if (pointerY < rect.top + edgeThreshold) {
          delta = -Math.min(maxStep, Math.ceil((rect.top + edgeThreshold - pointerY) / 3))
        } else if (pointerY > rect.bottom - edgeThreshold) {
          delta = Math.min(maxStep, Math.ceil((pointerY - (rect.bottom - edgeThreshold)) / 3))
        }

        if (delta !== 0) {
          scrollTarget.scrollTop += delta
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = null
    }
  }, [activeId])

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent): void => {
    setActiveId(String(active.id))
    const startY = getClientY(activatorEvent)
    pointerYRef.current = startY
    dragStartYRef.current = startY
    scrollTargetRef.current = getClosestScrollableAncestor(containerRef.current)
  }

  const handleDragMove = (event: DragMoveEvent): void => {
    const startY = dragStartYRef.current
    if (startY !== null) {
      pointerYRef.current = startY + event.delta.y
      return
    }

    const fallbackY = getClientY(event.activatorEvent)
    pointerYRef.current = fallbackY
  }

  const clearDragState = (): void => {
    setActiveId(null)
    dragStartYRef.current = null
    pointerYRef.current = null
    scrollTargetRef.current = null
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = null
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const draggedId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) {
      clearDragState()
      return
    }

    const fromIndex = itemIds.indexOf(draggedId)
    const overIndex = itemIds.indexOf(overId)

    if (fromIndex !== -1 && overIndex !== -1 && fromIndex !== overIndex) {
      const insertionIndex = fromIndex < overIndex ? overIndex + 1 : overIndex
      onReorder(draggedId, insertionIndex)
    }

    clearDragState()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      autoScroll={false}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div ref={containerRef} className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(sortableArgs) => renderItem(item, index, sortableArgs)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
