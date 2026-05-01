import type { ReactNode } from 'react'

export type ActivitySidebarItemId = 'projects' | 'terminals' | 'running' | 'companion'

type ActivityIconName = 'companion' | 'projects' | 'running' | 'terminals'

export type ActivitySidebarItem = {
  badge?: number | string
  icon: ActivityIconName
  id: ActivitySidebarItemId
  label: string
}

type ActivitySidebarProps = {
  activeItemId: ActivitySidebarItemId
  items: ActivitySidebarItem[]
  onSelect: (itemId: ActivitySidebarItemId) => void
}

function ActivityIcon({ name }: { name: ActivityIconName }): ReactNode {
  switch (name) {
    case 'projects':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3.5 6.5h6l2 2h9v10h-17z" />
          <path d="M3.5 6.5v-1.5h6.5l2 2h8.5v1.5" />
        </svg>
      )
    case 'terminals':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h16v14h-16z" />
          <path d="M7 9l3 3-3 3" />
          <path d="M12 16h5" />
        </svg>
      )
    case 'running':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M8 5l11 7-11 7z" />
          <path d="M4 5v14" />
        </svg>
      )
    case 'companion':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M6 19v-9a6 6 0 0 1 12 0v9l-3-2-3 2-3-2z" />
          <path d="M9.2 11.2h.1" />
          <path d="M14.7 11.2h.1" />
        </svg>
      )
  }
}

export function ActivitySidebar({
  activeItemId,
  items,
  onSelect
}: ActivitySidebarProps): React.JSX.Element {
  return (
    <nav className="activity-sidebar" aria-label="Primary navigation">
      <div className="activity-sidebar-group">
        {items.map((item) => (
          <button
            key={item.id}
            className={`activity-sidebar-item${
              item.id === activeItemId ? ' activity-sidebar-item--active' : ''
            }`}
            type="button"
            aria-label={item.label}
            aria-pressed={item.id === activeItemId}
            title={item.label}
            onClick={() => onSelect(item.id)}
          >
            <ActivityIcon name={item.icon} />
            {item.badge !== undefined && item.badge !== 0 && (
              <span className="activity-sidebar-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
