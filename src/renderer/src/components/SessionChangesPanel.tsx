import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkspaceChangedFile, WorkspaceChangesResult } from '../../../shared/system'
import type { RunningSession, WorkspaceCodeEditorSettings } from '../../../shared/workspace'

type SessionChangesPanelProps = {
  codeEditorSettings: WorkspaceCodeEditorSettings
  onClose: () => void
  onOpenMarkdownFile: (filePath: string) => void
  session: RunningSession
}

type LoadState = 'loading' | 'ready'

const CHANGE_GROUP_LABELS: Record<WorkspaceChangedFile['kind'], string> = {
  added: 'Added',
  conflicted: 'Conflicted',
  copied: 'Copied',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
  untracked: 'Untracked'
}

const CHANGE_GROUP_ORDER: WorkspaceChangedFile['kind'][] = [
  'conflicted',
  'modified',
  'added',
  'untracked',
  'renamed',
  'copied',
  'deleted'
]

function getFailureMessage(result: Extract<WorkspaceChangesResult, { ok: false }>): string {
  if (result.reason === 'invalid_target') return 'This terminal does not have a valid folder.'
  if (result.reason === 'not_found') return 'The terminal folder no longer exists.'
  if (result.reason === 'not_git_repo') return 'No Git repo found for this terminal.'

  return 'Could not read Git changes.'
}

function getOpenLabel(file: WorkspaceChangedFile): string {
  if (file.kind === 'deleted') return 'Deleted file'
  if (file.isMarkdown) return 'Open in Vaults'

  return 'Open in editor'
}

export function SessionChangesPanel({
  codeEditorSettings,
  onClose,
  onOpenMarkdownFile,
  session
}: SessionChangesPanelProps): React.JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [result, setResult] = useState<WorkspaceChangesResult | null>(null)

  const fetchChanges = useCallback(
    (): Promise<WorkspaceChangesResult> => window.api.system.listChangedFiles({ cwd: session.cwd }),
    [session.cwd]
  )

  const refreshChanges = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    const nextResult = await fetchChanges()
    setResult(nextResult)
    setLoadState('ready')
  }, [fetchChanges])

  useEffect(() => {
    let cancelled = false

    void fetchChanges().then((nextResult) => {
      if (cancelled) return

      setResult(nextResult)
      setLoadState('ready')
    })

    return () => {
      cancelled = true
    }
  }, [fetchChanges])

  const groupedFiles = useMemo(() => {
    if (!result?.ok) return []

    return CHANGE_GROUP_ORDER.map((kind) => ({
      files: result.files.filter((file) => file.kind === kind),
      kind
    })).filter((group) => group.files.length > 0)
  }, [result])

  const openProjectInEditor = (): void => {
    if (!result?.ok) return

    void window.api.system.openTarget({
      editor: codeEditorSettings.preferredEditor,
      kind: 'file_path',
      path: result.repoRoot
    })
  }

  const openFile = (file: WorkspaceChangedFile): void => {
    if (file.kind === 'deleted') return

    if (file.isMarkdown) {
      onOpenMarkdownFile(file.absolutePath)
      return
    }

    void window.api.system.openTarget({
      editor: codeEditorSettings.preferredEditor,
      kind: 'file_path',
      path: file.absolutePath
    })
  }

  return (
    <aside className="session-changes-panel" aria-label="Workspace changes">
      <header className="session-changes-header">
        <div>
          <span className="eyebrow">Changes</span>
          <strong>{session.cwd || session.name}</strong>
        </div>
        <div className="session-changes-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={loadState === 'loading'}
            onClick={() => {
              void refreshChanges()
            }}
          >
            Refresh
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </header>

      {loadState === 'loading' && <div className="session-changes-empty">Reading changes...</div>}

      {loadState === 'ready' && result?.ok === false && (
        <div className="session-changes-empty">{getFailureMessage(result)}</div>
      )}

      {loadState === 'ready' && result?.ok === true && (
        <>
          <div className="session-changes-summary">
            <span>
              {result.files.length} changed {result.files.length === 1 ? 'file' : 'files'}
            </span>
            <button
              className="secondary-button"
              type="button"
              disabled={!result.repoRoot}
              onClick={openProjectInEditor}
            >
              Open project
            </button>
          </div>

          {result.files.length === 0 ? (
            <div className="session-changes-empty">No changed files in this repo.</div>
          ) : (
            <div className="session-changes-list app-dark-scroll">
              {groupedFiles.map((group) => (
                <section className="session-changes-group" key={group.kind}>
                  <h2>{CHANGE_GROUP_LABELS[group.kind]}</h2>
                  <ul>
                    {group.files.map((file) => (
                      <li key={`${file.status}-${file.path}`}>
                        <button
                          className="session-change-file"
                          type="button"
                          disabled={file.kind === 'deleted'}
                          title={file.absolutePath}
                          onClick={() => openFile(file)}
                        >
                          <span
                            className={`session-change-status session-change-status--${file.kind}`}
                          >
                            {file.status}
                          </span>
                          <span className="session-change-path">
                            <strong>{file.path}</strong>
                            {file.oldPath ? <small>from {file.oldPath}</small> : null}
                          </span>
                          <span className="session-change-open-label">{getOpenLabel(file)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
