import type { ActivitySidebarItemId } from '../components/ActivitySidebar'

export function shouldShowWorkspaceRail(activeItemId: ActivitySidebarItemId): boolean {
  return activeItemId === 'terminal'
}

export function shouldShowVaultRail(activeItemId: ActivitySidebarItemId): boolean {
  return activeItemId === 'vaults'
}

export function hasContextRail(activeItemId: ActivitySidebarItemId): boolean {
  return shouldShowWorkspaceRail(activeItemId) || shouldShowVaultRail(activeItemId)
}
