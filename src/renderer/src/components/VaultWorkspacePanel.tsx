import { useEffect, useMemo, useState } from 'react'
import type { VaultConfig, VaultMarkdownFile } from '../../../shared/vault'

type VaultWorkspacePanelProps = {
  activeVault: VaultConfig | null
  onFileSaved: (file: VaultMarkdownFile) => void
  selectedFilePath: string | null
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export function VaultWorkspacePanel({
  activeVault,
  onFileSaved,
  selectedFilePath
}: VaultWorkspacePanelProps): React.JSX.Element {
  const [file, setFile] = useState<VaultMarkdownFile | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = content !== savedContent
  const selectedFile = file?.path === selectedFilePath ? file : null
  const title = selectedFile?.name ?? 'Vaults'
  const relativePath = selectedFile?.relativePath ?? activeVault?.rootPath ?? ''
  const wordCount = useMemo(() => {
    const words = content.trim().match(/\S+/g)
    return words?.length ?? 0
  }, [content])

  useEffect(() => {
    let mounted = true

    if (!activeVault || !selectedFilePath) {
      return () => {
        mounted = false
      }
    }

    const loadFile = async (): Promise<void> => {
      setLoadState('loading')
      setError(null)

      try {
        const nextFile = await window.api.vault.readMarkdownFile({
          filePath: selectedFilePath,
          rootPath: activeVault.rootPath
        })
        if (!mounted) return
        setFile(nextFile)
        setContent(nextFile.content)
        setSavedContent(nextFile.content)
        setLoadState('ready')
      } catch (loadError) {
        if (!mounted) return
        setFile(null)
        setContent('')
        setSavedContent('')
        setError(loadError instanceof Error ? loadError.message : 'Could not open file.')
        setLoadState('error')
      }
    }

    void loadFile()

    return () => {
      mounted = false
    }
  }, [activeVault, selectedFilePath])

  const saveFile = async (): Promise<void> => {
    if (!activeVault || !selectedFile || !isDirty) return

    setIsSaving(true)
    setError(null)

    try {
      const savedFile = await window.api.vault.saveMarkdownFile({
        content,
        filePath: selectedFile.path,
        rootPath: activeVault.rootPath
      })
      setFile(savedFile)
      setContent(savedFile.content)
      setSavedContent(savedFile.content)
      onFileSaved(savedFile)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save file.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!activeVault) {
    return (
      <section className="vault-workspace-panel" aria-label="Vault workspace">
        <div className="vault-empty-state">
          <h1>Vaults</h1>
          <p>Select or create a vault to browse Markdown files.</p>
        </div>
      </section>
    )
  }

  if (!selectedFilePath) {
    return (
      <section className="vault-workspace-panel" aria-label="Vault workspace">
        <div className="vault-empty-state">
          <h1>{activeVault.name}</h1>
          <p>Select a Markdown file or create a new note.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="vault-workspace-panel" aria-label="Vault workspace">
      <header className="vault-editor-header">
        <div>
          <span className="eyebrow">{activeVault.name}</span>
          <h1>{title}</h1>
          <small>{relativePath}</small>
        </div>
        <div className="vault-editor-actions">
          <span className="vault-editor-status">
            {isDirty ? 'Unsaved' : isSaving ? 'Saving...' : 'Saved'} · {wordCount} words
          </span>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedFile || !isDirty || isSaving || loadState !== 'ready'}
            onClick={saveFile}
          >
            Save
          </button>
        </div>
      </header>

      {loadState === 'loading' && <div className="vault-empty-state">Opening file...</div>}
      {error && <div className="vault-error-state">{error}</div>}

      {loadState === 'ready' && selectedFile && (
        <textarea
          className="vault-temp-editor"
          value={content}
          spellCheck={false}
          onChange={(event) => setContent(event.target.value)}
        />
      )}
    </section>
  )
}
