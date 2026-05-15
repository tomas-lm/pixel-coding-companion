import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunningSession } from '../../../shared/workspace'
import { TerminalPane } from './TerminalPane'

const { MockTerminal } = vi.hoisted(() => {
  class MockTerminalClass {
    static instances: MockTerminalClass[] = []

    buffer = {
      active: {
        getLine: vi.fn()
      }
    }
    cols = 80
    rows = 24
    selection = 'selected terminal text'
    attachCustomKeyEventHandler = vi.fn()
    clear = vi.fn()
    dispose = vi.fn()
    focus = vi.fn()
    getSelection = vi.fn(() => this.selection)
    hasSelection = vi.fn(() => true)
    loadAddon = vi.fn()
    onData = vi.fn(() => ({ dispose: vi.fn() }))
    open = vi.fn()
    registerLinkProvider = vi.fn(() => ({ dispose: vi.fn() }))
    scrollToBottom = vi.fn()
    selectAll = vi.fn()
    options = { theme: {} }
    writeln = vi.fn()
    write = vi.fn()

    constructor() {
      MockTerminalClass.instances.push(this)
    }
  }

  return { MockTerminal: MockTerminalClass }
})

vi.mock('@xterm/xterm', () => ({
  Terminal: MockTerminal
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  }
}))

vi.mock('./TerminalContextHud', () => ({
  TerminalContextHud: () => <div data-testid="terminal-context-hud" />
}))

const session: RunningSession = {
  commands: ['pnpm dev'],
  configId: 'terminal-1',
  cwd: '/repo',
  id: 'session-1',
  kind: 'shell',
  lastActivityAt: '2026-05-04T10:00:00.000Z',
  metadata: '/repo',
  name: 'Shell',
  projectColor: '#4ea1ff',
  projectId: 'project-1',
  projectName: 'Pixel',
  startedAt: '2026-05-04T10:00:00.000Z',
  status: 'running',
  terminalColor: '#5fb3ff'
}

function createCopyEvent(): KeyboardEvent {
  return {
    altKey: false,
    ctrlKey: true,
    isComposing: false,
    key: 'c',
    metaKey: false,
    preventDefault: vi.fn(),
    shiftKey: true,
    stopPropagation: vi.fn(),
    type: 'keydown'
  } as unknown as KeyboardEvent
}

describe('TerminalPane', () => {
  afterEach(() => {
    MockTerminal.instances = []
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('copies the current selection on Linux Ctrl+Shift+C', () => {
    const originalPlatform = navigator.platform
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect = vi.fn()
        observe = vi.fn()
        unobserve = vi.fn()
      }
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    const clipboardWriteText = vi.fn()
    try {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: 'Linux x86_64'
      })

      Object.assign(window, {
        api: {
          clipboard: {
            writeText: clipboardWriteText
          },
          companion: {
            loadBridgeState: vi.fn(),
            loadProgress: vi.fn(),
            loadStoreState: vi.fn(),
            openBox: vi.fn(),
            selectCompanion: vi.fn(),
            selectStarter: vi.fn()
          },
          system: {
            openTarget: vi.fn()
          },
          terminal: {
            onCommandExit: vi.fn(() => vi.fn()),
            onContext: vi.fn(() => vi.fn()),
            onData: vi.fn(() => vi.fn()),
            onExit: vi.fn(() => vi.fn()),
            resize: vi.fn(),
            start: vi.fn(() =>
              Promise.resolve({
                attached: false,
                cwd: session.cwd,
                id: session.id,
                pid: 1234,
                shell: '/bin/zsh'
              })
            ),
            stop: vi.fn(),
            write: vi.fn()
          },
          view: {
            onResetLayout: vi.fn()
          },
          workspace: {
            loadConfig: vi.fn(),
            pickFolder: vi.fn(),
            saveConfig: vi.fn()
          }
        }
      })

      render(
        <TerminalPane
          codeEditorSettings={{ preferredEditor: 'auto' }}
          isActive={true}
          onSessionActivity={vi.fn()}
          onSessionStartError={vi.fn()}
          onSessionStarted={vi.fn()}
          session={session}
          terminalThemeId="catppuccin_mocha"
        />
      )

      const terminal = MockTerminal.instances[0]
      const keyHandler = terminal.attachCustomKeyEventHandler.mock.calls[0][0] as (
        event: KeyboardEvent
      ) => boolean
      const event = createCopyEvent()

      expect(keyHandler(event)).toBe(false)
      expect(terminal.hasSelection).toHaveBeenCalled()
      expect(terminal.getSelection).toHaveBeenCalled()
      expect(clipboardWriteText).toHaveBeenCalledWith('selected terminal text')
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        value: originalPlatform
      })
    }
  })
})
