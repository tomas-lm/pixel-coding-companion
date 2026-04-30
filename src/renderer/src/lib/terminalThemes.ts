import type { ITheme } from '@xterm/xterm'
import type { CSSProperties } from 'react'
import { DEFAULT_TERMINAL_THEME_ID, type TerminalThemeId } from '../../../shared/workspace'

type TerminalThemeStyle = CSSProperties & Record<`--terminal-${string}`, string>

const TERMINAL_THEMES: Record<TerminalThemeId, ITheme> = {
  catppuccin_mocha: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e',
    selectionBackground: '#45475a',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#eba0ac',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#cdd6f4'
  },
  one_dark_pro: {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#282c34',
    selectionBackground: '#3e4451',
    black: '#5c6370',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#7f848e',
    brightRed: '#f07178',
    brightGreen: '#a5e075',
    brightYellow: '#ffd580',
    brightBlue: '#82aaff',
    brightMagenta: '#c792ea',
    brightCyan: '#89ddff',
    brightWhite: '#d7dae0'
  },
  tokyo_night: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    cursorAccent: '#1a1b26',
    selectionBackground: '#33467c',
    black: '#414868',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#565f89',
    brightRed: '#ff7a93',
    brightGreen: '#b9f27c',
    brightYellow: '#ff9e64',
    brightBlue: '#7da6ff',
    brightMagenta: '#c0a3ff',
    brightCyan: '#89ddff',
    brightWhite: '#c0caf5'
  },
  github_dark: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc'
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff'
  },
  pixel_classic: {
    background: '#0d1117',
    foreground: '#d1f7d6',
    cursor: '#7fe7dc',
    cursorAccent: '#0d1117',
    selectionBackground: '#284b63',
    black: '#17202a',
    red: '#ef5b5b',
    green: '#34d399',
    yellow: '#f7d56f',
    blue: '#4ea1ff',
    magenta: '#c084fc',
    cyan: '#7fe7dc',
    white: '#d1f7d6',
    brightBlack: '#5b6470',
    brightRed: '#ff7777',
    brightGreen: '#6ee7b7',
    brightYellow: '#ffe38a',
    brightBlue: '#7bbcff',
    brightMagenta: '#d8b4fe',
    brightCyan: '#a7fff3',
    brightWhite: '#ffffff'
  }
}

export function getTerminalTheme(themeId: TerminalThemeId): ITheme {
  return TERMINAL_THEMES[themeId] ?? TERMINAL_THEMES[DEFAULT_TERMINAL_THEME_ID]
}

export function getTerminalThemeStyle(themeId: TerminalThemeId): TerminalThemeStyle {
  const theme = getTerminalTheme(themeId)
  const background = theme.background ?? '#0d1117'
  const foreground = theme.foreground ?? '#d1f7d6'

  return {
    '--terminal-background': background,
    '--terminal-foreground': foreground,
    '--terminal-blue': theme.blue ?? '#4ea1ff',
    '--terminal-bright-black': theme.brightBlack ?? theme.black ?? '#5b6470',
    '--terminal-cyan': theme.cyan ?? '#7fe7dc',
    '--terminal-green': theme.green ?? '#34d399',
    '--terminal-red': theme.red ?? '#ef5b5b',
    '--terminal-yellow': theme.yellow ?? '#f7d56f'
  }
}
