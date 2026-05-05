import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  WorkspaceChangedFile,
  WorkspaceChangesRootResult,
  WorkspaceChangesResult
} from '../../../shared/system'
import type {
  Project,
  RunningSession,
  WorkspaceCodeEditorSettings
} from '../../../shared/workspace'

type SessionChangesPanelProps = {
  activeProject: Project | null
  codeEditorSettings: WorkspaceCodeEditorSettings
  onClose: () => void
  onOpenMarkdownFile: (filePath: string) => void
  session: RunningSession
}

type LoadState = 'loading' | 'ready'

const EMPTY_CHANGE_ROOTS: NonNullable<Project['changeRoots']> = []

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

const ROOT_FAILURE_MESSAGES: Record<
  Extract<WorkspaceChangesRootResult, { ok: false }>['reason'],
  string
> = {
  invalid_target: 'This change root is not valid.',
  not_found: 'This folder no longer exists.',
  not_git_repo: 'No Git repo found for this folder.',
  open_failed: 'Could not read Git changes for this folder.'
}

function getFailureMessage(result: Extract<WorkspaceChangesResult, { ok: false }>): string {
  if (result.reason === 'invalid_target') return 'This terminal does not have a valid folder.'
  if (result.reason === 'not_found') return 'The terminal folder no longer exists.'
  if (result.reason === 'not_git_repo') return 'No Git repo found for this terminal.'

  return 'Could not read Git changes.'
}

function getRootLabel(root: WorkspaceChangesRootResult): string {
  if (root.ok) return root.label || root.repoRoot

  return root.label || root.path
}

function getOpenLabel(file: WorkspaceChangedFile): string {
  if (file.kind === 'deleted') return 'Deleted file'
  if (file.isMarkdown) return 'Open in Vaults'

  return 'Open in editor'
}

export function SessionChangesPanel({
  activeProject,
  codeEditorSettings,
  onClose,
  onOpenMarkdownFile,
  session
}: SessionChangesPanelProps): React.JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [result, setResult] = useState<WorkspaceChangesResult | null>(null)
  const changeRoots: NonNullable<Project['changeRoots']> =
    activeProject?.changeRoots ?? EMPTY_CHANGE_ROOTS
  const hasProjectChangeRoots = changeRoots.length > 0

  const fetchChanges = useCallback(
    (): Promise<WorkspaceChangesResult> =>
      window.api.system.listChangedFiles({
        cwd: session.cwd,
        ...(hasProjectChangeRoots
          ? {
              roots: changeRoots.map((root) => ({
                id: root.id,
                ...(root.label ? { label: root.label } : {}),
                path: root.path
              }))
            }
          : {})
      }),
    [changeRoots, hasProjectChangeRoots, session.cwd]
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

  const totalChangedFiles = useMemo(() => {
    if (!result?.ok) return 0

    return result.roots.reduce(
      (totalFiles, root) => totalFiles + (root.ok ? root.files.length : 0),
      0
    )
  }, [result])

  const openRootInEditor = (root: Extract<WorkspaceChangesRootResult, { ok: true }>): void => {
    void window.api.system.openTarget({
      editor: codeEditorSettings.preferredEditor,
      kind: 'file_path',
      path: root.repoRoot
    })
  }

  const openConfiguredRootInEditor = (root: WorkspaceChangesRootResult): void => {
    void window.api.system.openTarget({
      editor: codeEditorSettings.preferredEditor,
      kind: 'file_path',
      path: root.path
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
          <strong>
            {hasProjectChangeRoots
              ? (activeProject?.name ?? 'Workspace')
              : session.cwd || session.name}
          </strong>
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
              {totalChangedFiles} changed {totalChangedFiles === 1 ? 'file' : 'files'} across{' '}
              {result.roots.length} {result.roots.length === 1 ? 'root' : 'roots'}
            </span>
          </div>

          {result.roots.length === 0 ? (
            <div className="session-changes-empty">No changed files in these roots.</div>
          ) : (
            <div className="session-changes-list app-dark-scroll">
              {result.roots.map((root) => (
                <section className="session-changes-root" key={root.id}>
                  <header>
                    <div>
                      <h2>{getRootLabel(root)}</h2>
                      <small>{root.ok ? root.repoRoot : root.path}</small>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        if (root.ok) {
                          openRootInEditor(root)
                          return
                        }

                        openConfiguredRootInEditor(root)
                      }}
                    >
                      Open root
                    </button>
                  </header>

                  {!root.ok ? (
                    <div className="session-changes-root-error">
                      {ROOT_FAILURE_MESSAGES[root.reason]}
                    </div>
                  ) : root.files.length === 0 ? (
                    <div className="session-changes-root-empty">No changes in this root.</div>
                  ) : (
                    CHANGE_GROUP_ORDER.map((kind) => ({
                      files: root.files.filter((file) => file.kind === kind),
                      kind
                    }))
                      .filter((group) => group.files.length > 0)
                      .map((group) => (
                        <section className="session-changes-group" key={`${root.id}-${group.kind}`}>
                          <h3>{CHANGE_GROUP_LABELS[group.kind]}</h3>
                          <ul>
                            {group.files.map((file) => (
                              <li key={`${root.id}-${file.status}-${file.path}`}>
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
                                  <span className="session-change-open-label">
                                    {getOpenLabel(file)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
