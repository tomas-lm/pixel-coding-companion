export const SYSTEM_CHANNELS = {
  checkCodeEditor: 'system:check-code-editor',
  listChangedFiles: 'system:list-changed-files',
  openTarget: 'system:open-target'
} as const

export const CODE_EDITOR_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' }
] as const

export type CodeEditorId = (typeof CODE_EDITOR_OPTIONS)[number]['id']

export type CodeEditorCheckRequest = {
  editor: CodeEditorId
}

export type CodeEditorCheckResult =
  | {
      ok: true
      command: string
      editor: CodeEditorId
      label: string
      resolvedEditor: Exclude<CodeEditorId, 'auto'>
    }
  | {
      ok: false
      editor: CodeEditorId
      label: string
      reason: 'not_found'
    }

export type OpenTargetRequest =
  | { kind: 'external_url'; url: string }
  | { kind: 'file_url'; url: string }
  | {
      kind: 'file_path'
      column?: number
      cwd?: string
      editor?: CodeEditorId
      line?: number
      path: string
    }

export type OpenTargetResult =
  | { ok: true; resolvedTarget?: string }
  | { ok: false; reason: 'unsupported_protocol' | 'not_found' | 'invalid_target' | 'open_failed' }

export type WorkspaceChangeKind =
  | 'added'
  | 'conflicted'
  | 'copied'
  | 'deleted'
  | 'modified'
  | 'renamed'
  | 'untracked'

export type WorkspaceChangedFile = {
  absolutePath: string
  isMarkdown: boolean
  isTest: boolean
  kind: WorkspaceChangeKind
  oldPath?: string
  path: string
  status: string
}

export type WorkspaceChangesRequest = {
  cwd?: string
}

export type WorkspaceChangesResult =
  | {
      ok: true
      files: WorkspaceChangedFile[]
      repoRoot: string
    }
  | {
      ok: false
      reason: 'invalid_target' | 'not_found' | 'not_git_repo' | 'open_failed'
    }

export type ClipboardApi = {
  writeText: (text: string) => void
}

export type SystemApi = {
  checkCodeEditor: (request: CodeEditorCheckRequest) => Promise<CodeEditorCheckResult>
  listChangedFiles: (request: WorkspaceChangesRequest) => Promise<WorkspaceChangesResult>
  openTarget: (request: OpenTargetRequest) => Promise<OpenTargetResult>
}
