import { join } from 'path'
import { readFile } from 'fs/promises'
import type { TerminalCompanionContext, TerminalSessionId } from '../../shared/terminal'
import { writeJsonFile } from '../persistence/jsonStore'

type TerminalContextRegistryEntry = TerminalCompanionContext & {
  shellPid: number
  startedAt: string
  updatedAt: string
}

export class TerminalContextRegistry {
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly getUserDataPath: () => string) {}

  async clear(): Promise<void> {
    await this.writeRegistry([])
  }

  async writeCompanionContext(
    sessionId: TerminalSessionId,
    context?: TerminalCompanionContext
  ): Promise<Record<string, string>> {
    if (!context) return {}

    const contextPath = this.getCompanionContextPath(sessionId)
    const contextFile = {
      ...context,
      sessionId,
      updatedAt: new Date().toISOString()
    }

    await writeJsonFile(contextPath, contextFile)

    return {
      PIXEL_COMPANION_CONTEXT_FILE: contextPath,
      PIXEL_COMPANION_CWD: context.cwd ?? '',
      PIXEL_COMPANION_PROJECT_COLOR: context.projectColor,
      PIXEL_COMPANION_PROJECT_ID: context.projectId,
      PIXEL_COMPANION_PROJECT_NAME: context.projectName,
      PIXEL_COMPANION_SESSION_ID: sessionId,
      PIXEL_COMPANION_TERMINAL_ID: context.terminalId,
      PIXEL_COMPANION_TERMINAL_NAME: context.terminalName
    }
  }

  async registerProcess(
    sessionId: TerminalSessionId,
    shellPid: number,
    context?: TerminalCompanionContext
  ): Promise<void> {
    if (!context) return

    const now = new Date().toISOString()
    await this.updateRegistry((registry) => {
      const nextRegistry = registry.filter((entry) => entry.sessionId !== sessionId)

      nextRegistry.push({
        ...context,
        sessionId,
        shellPid,
        startedAt: now,
        updatedAt: now
      })

      return nextRegistry
    })
  }

  async unregisterProcess(sessionId: TerminalSessionId): Promise<void> {
    await this.updateRegistry((registry) =>
      registry.filter((entry) => entry.sessionId !== sessionId)
    )
  }

  private getContextDirectoryPath(): string {
    return join(this.getUserDataPath(), 'terminal-contexts')
  }

  private getCompanionContextPath(sessionId: TerminalSessionId): string {
    return join(this.getContextDirectoryPath(), `${sessionId}.json`)
  }

  private getRegistryPath(): string {
    return join(this.getContextDirectoryPath(), 'registry.json')
  }

  private async readRegistry(): Promise<TerminalContextRegistryEntry[]> {
    try {
      const file = await readFile(this.getRegistryPath(), 'utf8')
      const registry = JSON.parse(file)

      return Array.isArray(registry) ? (registry as TerminalContextRegistryEntry[]) : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      if (error instanceof SyntaxError) return []
      throw error
    }
  }

  private async writeRegistry(registry: TerminalContextRegistryEntry[]): Promise<void> {
    await writeJsonFile(this.getRegistryPath(), registry)
  }

  private async updateRegistry(
    updater: (registry: TerminalContextRegistryEntry[]) => TerminalContextRegistryEntry[]
  ): Promise<void> {
    const update = this.queue.then(async () => {
      const registry = await this.readRegistry()
      await this.writeRegistry(updater(registry))
    })

    this.queue = update.catch(() => undefined)
    await update
  }
}
