import type { CompanionApi } from '../shared/terminal'

declare global {
  interface Window {
    api: CompanionApi
  }
}
