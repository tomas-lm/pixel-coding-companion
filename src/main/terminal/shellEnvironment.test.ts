import { EventEmitter } from 'events'
import type { ChildProcess, SpawnOptions } from 'child_process'
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  getResolvedShellEnvironment,
  resetResolvedShellEnvironmentForTests,
  resolveUnixShellEnvironment
} from './shellEnvironment'

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill = vi.fn()
}

type SpawnMock = (command: string, args: string[], options: SpawnOptions) => ChildProcess

function createSpawnMock(child: MockChildProcess): ReturnType<typeof vi.fn<SpawnMock>> {
  return vi.fn<SpawnMock>(() => child as unknown as ChildProcess)
}

afterEach(() => {
  vi.restoreAllMocks()
  resetResolvedShellEnvironmentForTests()
})

describe('shellEnvironment', () => {
  it('skips shell environment resolution on Windows', async () => {
    const spawnProcess = createSpawnMock(new MockChildProcess())

    await expect(
      resolveUnixShellEnvironment({
        getDefaultShell: () => 'powershell.exe',
        platform: 'win32',
        spawnProcess
      })
    ).resolves.toEqual({})
    expect(spawnProcess).not.toHaveBeenCalled()
  })

  it('resolves marker-wrapped shell environment from an interactive login shell', async () => {
    const child = new MockChildProcess()
    const spawnProcess = createSpawnMock(child)
    const envPromise = resolveUnixShellEnvironment({
      env: { PATH: '/usr/bin' },
      execPath: '/Applications/Pixel Companion.app/Contents/MacOS/Pixel Companion',
      getDefaultShell: () => '/bin/zsh',
      platform: 'darwin',
      spawnProcess
    })

    const [, args, options] = spawnProcess.mock.calls[0]
    expect(args.slice(0, 3)).toEqual(['-i', '-l', '-c'])
    expect(options.env).toMatchObject({
      ELECTRON_NO_ATTACH_CONSOLE: '1',
      ELECTRON_RUN_AS_NODE: '1',
      PIXEL_COMPANION_RESOLVING_ENVIRONMENT: '1'
    })

    const markerMatch = /"(pixel[a-f0-9]+)"/.exec(args[3])
    expect(markerMatch).toBeTruthy()
    const marker = markerMatch?.[1] ?? ''
    child.stdout.emit(
      'data',
      Buffer.from(
        `shell noise\n${marker}{"PATH":"/opt/homebrew/bin","XDG_RUNTIME_DIR":"/tmp/x"}${marker}\n`
      )
    )
    child.emit('close', 0, null)

    await expect(envPromise).resolves.toEqual({
      PATH: '/opt/homebrew/bin'
    })
  })

  it('returns an empty env when the shell exits unsuccessfully', async () => {
    const child = new MockChildProcess()
    const spawnProcess = createSpawnMock(child)
    const envPromise = resolveUnixShellEnvironment({
      getDefaultShell: () => '/bin/zsh',
      platform: 'linux',
      spawnProcess
    })

    child.emit('close', 1, null)

    await expect(envPromise).resolves.toEqual({})
  })

  it('caches resolved shell environment', async () => {
    const child = new MockChildProcess()
    const spawnProcess = createSpawnMock(child)
    const first = getResolvedShellEnvironment({
      getDefaultShell: () => '/bin/zsh',
      platform: 'darwin',
      spawnProcess
    })
    const second = getResolvedShellEnvironment({
      getDefaultShell: () => '/bin/zsh',
      platform: 'darwin',
      spawnProcess
    })

    const [, args] = spawnProcess.mock.calls[0]
    const markerMatch = /"(pixel[a-f0-9]+)"/.exec(args[3])
    const marker = markerMatch?.[1] ?? ''
    child.stdout.emit('data', Buffer.from(`${marker}{"PATH":"/bin"}${marker}`))
    child.emit('close', 0, null)

    await expect(first).resolves.toEqual({ PATH: '/bin' })
    await expect(second).resolves.toEqual({ PATH: '/bin' })
    expect(spawnProcess).toHaveBeenCalledTimes(1)
  })

  it('does not cache failed shell environment resolution', async () => {
    const firstChild = new MockChildProcess()
    const secondChild = new MockChildProcess()
    const spawnProcess = vi
      .fn<SpawnMock>()
      .mockReturnValueOnce(firstChild as unknown as ChildProcess)
      .mockReturnValueOnce(secondChild as unknown as ChildProcess)

    const first = getResolvedShellEnvironment({
      getDefaultShell: () => '/bin/zsh',
      platform: 'darwin',
      spawnProcess
    })
    firstChild.emit('close', 1, null)
    await expect(first).resolves.toEqual({})

    const second = getResolvedShellEnvironment({
      getDefaultShell: () => '/bin/zsh',
      platform: 'darwin',
      spawnProcess
    })
    const [, args] = spawnProcess.mock.calls[1]
    const markerMatch = /"(pixel[a-f0-9]+)"/.exec(args[3])
    const marker = markerMatch?.[1] ?? ''
    secondChild.stdout.emit('data', Buffer.from(`${marker}{"PATH":"/retry"}${marker}`))
    secondChild.emit('close', 0, null)

    await expect(second).resolves.toEqual({ PATH: '/retry' })
    expect(spawnProcess).toHaveBeenCalledTimes(2)
  })
})
