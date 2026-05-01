import type { ReactNode } from 'react'

export type ActivitySidebarItemId = 'terminal' | 'companions'

type ActivityIconName = 'companion' | 'terminal'

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
    case 'terminal':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h16v14h-16z" />
          <path d="M7 9l3 3-3 3" />
          <path d="M12 16h5" />
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
