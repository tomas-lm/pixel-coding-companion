import type { ReactNode } from 'react'

export type ActivitySidebarItemId =
  | 'terminal'
  | 'companions'
  | 'prompts'
  | 'dictation'
  | 'configs'
  | 'vaults'

type ActivityIconName = 'companion' | 'configs' | 'dictation' | 'prompts' | 'terminal' | 'vaults'

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
    case 'prompts':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 4h14v16h-14z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      )
    case 'configs':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M9.8 3.2h4.4l.5 2.2c.5.2 1 .5 1.4.8l2.1-.7 2.2 3.8-1.7 1.5c.1.4.1.8.1 1.2s0 .8-.1 1.2l1.7 1.5-2.2 3.8-2.1-.7c-.4.3-.9.6-1.4.8l-.5 2.2h-4.4l-.5-2.2c-.5-.2-1-.5-1.4-.8l-2.1.7-2.2-3.8 1.7-1.5c-.1-.4-.1-.8-.1-1.2s0-.8.1-1.2l-1.7-1.5 2.2-3.8 2.1.7c.4-.3.9-.6 1.4-.8z" />
          <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
        </svg>
      )
    case 'dictation':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
          <path d="M9 21h6" />
        </svg>
      )
    case 'vaults':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M3.5 6.5h6l1.7 2h9.3v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
          <path d="M3.5 8.5v-2a2 2 0 0 1 2-2h3.4l1.7 2z" />
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
