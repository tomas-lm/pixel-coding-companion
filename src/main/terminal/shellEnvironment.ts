import { spawn, type ChildProcess, type SpawnOptions } from 'child_process'
import { randomUUID } from 'crypto'
import { basename } from 'path'

type ProcessEnv = Record<string, string>
type SpawnProcess = (command: string, args: string[], options: SpawnOptions) => ChildProcess

export type ShellEnvironmentResolverOptions = {
  env?: NodeJS.ProcessEnv
  execPath?: string
  getDefaultShell: () => string
  platform?: NodeJS.Platform
  spawnProcess?: SpawnProcess
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10000

let resolvedShellEnvPromise: Promise<ProcessEnv> | undefined

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function getStringEnv(env: NodeJS.ProcessEnv = process.env): ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

function getShellEnvironmentCommand(
  shellName: string,
  execPath: string,
  mark: string
): {
  args: string[]
  command: string
} {
  if (/^(?:pwsh|powershell)(?:-preview)?$/.test(shellName)) {
    return {
      args: ['-Login', '-Command'],
      command: `& ${shellQuote(execPath)} -p '''${mark}'' + JSON.stringify(process.env) + ''${mark}'''`
    }
  }

  if (shellName === 'nu') {
    return {
      args: ['-i', '-l', '-c'],
      command: `^${shellQuote(execPath)} -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`
    }
  }

  if (shellName === 'xonsh') {
    return {
      args: ['-i', '-l', '-c'],
      command: `import os, json; print("${mark}", json.dumps(dict(os.environ)), "${mark}")`
    }
  }

  return {
    args: shellName === 'tcsh' || shellName === 'csh' ? ['-ic'] : ['-i', '-l', '-c'],
    command: `${shellQuote(execPath)} -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`
  }
}

function cleanupResolvedEnvironment(
  env: ProcessEnv,
  originalEnv: NodeJS.ProcessEnv,
  resolverEnvKey: string
): ProcessEnv {
  const nextEnv = { ...env }

  if (typeof originalEnv.ELECTRON_RUN_AS_NODE === 'string') {
    nextEnv.ELECTRON_RUN_AS_NODE = originalEnv.ELECTRON_RUN_AS_NODE
  } else {
    delete nextEnv.ELECTRON_RUN_AS_NODE
  }

  if (typeof originalEnv.ELECTRON_NO_ATTACH_CONSOLE === 'string') {
    nextEnv.ELECTRON_NO_ATTACH_CONSOLE = originalEnv.ELECTRON_NO_ATTACH_CONSOLE
  } else {
    delete nextEnv.ELECTRON_NO_ATTACH_CONSOLE
  }

  delete nextEnv[resolverEnvKey]
  delete nextEnv.XDG_RUNTIME_DIR

  return nextEnv
}

export async function resolveUnixShellEnvironment({
  env = process.env,
  execPath = process.execPath,
  getDefaultShell,
  platform = process.platform,
  spawnProcess = spawn,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: ShellEnvironmentResolverOptions): Promise<ProcessEnv> {
  if (platform === 'win32') return {}

  const mark = `pixel${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const shellPath = getDefaultShell()
  const shellName = basename(shellPath)
  const { args, command } = getShellEnvironmentCommand(shellName, execPath, mark)
  const resolverEnvKey = 'PIXEL_COMPANION_RESOLVING_ENVIRONMENT'
  const childEnv = {
    ...getStringEnv(env),
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
    [resolverEnvKey]: '1'
  }

  return new Promise<ProcessEnv>((resolve) => {
    let settled = false
    let child: ChildProcess
    const stdout: Buffer[] = []

    const finish = (value: ProcessEnv): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(value)
    }

    const timeout = setTimeout(() => {
      child?.kill()
      finish({})
    }, timeoutMs)

    try {
      child = spawnProcess(shellPath, [...args, command], {
        detached: true,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch {
      finish({})
      return
    }

    child.on('error', () => finish({}))
    child.stdout?.on('data', (buffer: Buffer) => stdout.push(buffer))
    child.on('close', (code, signal) => {
      if (code || signal) {
        finish({})
        return
      }

      const raw = Buffer.concat(stdout).toString('utf8')
      const match = new RegExp(`${mark}({.*})${mark}`, 's').exec(raw)
      if (!match) {
        finish({})
        return
      }

      try {
        finish(cleanupResolvedEnvironment(JSON.parse(match[1]), env, resolverEnvKey))
      } catch {
        finish({})
      }
    })
  })
}

export function getResolvedShellEnvironment(
  options: ShellEnvironmentResolverOptions
): Promise<ProcessEnv> {
  if (!resolvedShellEnvPromise) {
    resolvedShellEnvPromise = resolveUnixShellEnvironment(options).then((env) => {
      if (Object.keys(env).length === 0) {
        resolvedShellEnvPromise = undefined
      }

      return env
    })
  }

  return resolvedShellEnvPromise
}

export function resetResolvedShellEnvironmentForTests(): void {
  resolvedShellEnvPromise = undefined
}
