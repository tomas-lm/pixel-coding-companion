import type { ProjectChangeRoot } from '../../../shared/workspace'

export type ProjectForm = {
  id?: string
  name: string
  description: string
  color: string
  defaultFolder: string
  changeRoots: ProjectChangeRoot[]
}
