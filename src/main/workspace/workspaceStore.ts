import { readFile } from 'fs/promises'
import type { WorkspaceConfig } from '../../shared/workspace'
import { writeJsonFile } from '../persistence/jsonStore'

export class WorkspaceStore {
  constructor(private readonly getConfigPath: () => string) {}

  async load(): Promise<WorkspaceConfig | null> {
    try {
      const file = await readFile(this.getConfigPath(), 'utf8')
      return JSON.parse(file) as WorkspaceConfig
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async save(config: WorkspaceConfig): Promise<void> {
    await writeJsonFile(this.getConfigPath(), config)
  }
}
