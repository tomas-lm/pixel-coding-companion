import { useEffect, useRef, useState } from 'react'
import type { VaultConfig, VaultMarkdownFile } from '../../../shared/vault'
import type { SerializedMarkdownEditorState } from '../markdown/markdownEditorState'
import {
  findWikiLinkTarget,
  isExternalMarkdownLink,
  resolveMarkdownLinkTarget,
  resolveVaultRelativePath
} from '../markdown/markdownLinks'
import type { MarkdownEditorStats } from '../markdown/markdownStats'
import type { MarkdownTableOfContentsItem } from '../markdown/markdownToc'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'

type VaultWorkspacePanelProps = {
  activeVault: VaultConfig | null
  onCreateNote: (name: string) => Promise<void>
  onDirtyChange: (isDirty: boolean) => void
  onFileSaved: (file: VaultMarkdownFile) => void
  onSelectFile: (filePath: string) => void
  selectedFilePath: string | null
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export function VaultWorkspacePanel({
  activeVault,
  onCreateNote,
  onDirtyChange,
  onFileSaved,
  onSelectFile,
  selectedFilePath
}: VaultWorkspacePanelProps): React.JSX.Element {
  const editorRef = useRef<MarkdownEditorHandle | null>(null)
  const editorStatesRef = useRef(new Map<string, SerializedMarkdownEditorState>())
  const [file, setFile] = useState<VaultMarkdownFile | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editorMode, setEditorMode] = useState<'raw' | 'rendered'>('raw')
  const [stats, setStats] = useState<MarkdownEditorStats>({
    characters: 0,
    column: 1,
    line: 1,
    words: 0
  })
  const [tableOfContents, setTableOfContents] = useState<MarkdownTableOfContentsItem[]>([])
  const isDirty = content !== savedContent
  const selectedFile = file?.path === selectedFilePath ? file : null
  const activeVaultRootPath = activeVault?.rootPath ?? null
  const title = selectedFile?.name ?? 'Vaults'
  const relativePath = selectedFile?.relativePath ?? activeVault?.rootPath ?? ''
  const saveStateLabel = isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved'

  useEffect(() => {
    let mounted = true

    if (!activeVaultRootPath || !selectedFilePath) {
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
          rootPath: activeVaultRootPath
        })
        if (!mounted) return
        setFile(nextFile)
        setContent(nextFile.content)
        setSavedContent(nextFile.content)
        setLoadState('ready')
        onDirtyChange(false)
      } catch (loadError) {
        if (!mounted) return
        setFile(null)
        setContent('')
        setSavedContent('')
        setError(loadError instanceof Error ? loadError.message : 'Could not open file.')
        setLoadState('error')
        onDirtyChange(false)
      }
    }

    void loadFile()

    return () => {
      mounted = false
    }
  }, [activeVaultRootPath, onDirtyChange, selectedFilePath])

  const persistEditorState = (
    filePath: string,
    editorState: SerializedMarkdownEditorState
  ): void => {
    editorStatesRef.current.set(filePath, editorState)
  }

  const getPersistedEditorState = (filePath: string): SerializedMarkdownEditorState | undefined => {
    return editorStatesRef.current.get(filePath)
  }

  const changeContent = (nextContent: string): void => {
    setContent(nextContent)
    onDirtyChange(nextContent !== savedContent)
  }

  const openMarkdownLink = (href: string): void => {
    if (!activeVaultRootPath || !selectedFile) return

    const target = resolveMarkdownLinkTarget({
      currentFilePath: selectedFile.path,
      href,
      rootPath: activeVaultRootPath
    })

    if (target.kind === 'external') {
      void window.api.system.openTarget({
        kind: 'external_url',
        url: target.url
      })
      return
    }

    if (target.kind === 'local_markdown') {
      onSelectFile(target.path)
    }
  }

  const openWikiLink = async (target: string): Promise<void> => {
    if (!activeVaultRootPath) return

    const tree = await window.api.vault.listTree({ rootPath: activeVaultRootPath })
    const filePath = findWikiLinkTarget(tree, target)

    if (filePath) {
      onSelectFile(filePath)
      return
    }

    if (window.confirm(`Create "${target}" in this vault?`)) {
      await onCreateNote(target)
    }
  }

  const resolveImageSource = (href: string): string | null => {
    if (!activeVaultRootPath || !selectedFile) return null
    if (/^https?:/i.test(href.trim())) return href
    if (isExternalMarkdownLink(href)) return null

    const assetPath = resolveVaultRelativePath({
      currentFilePath: selectedFile.path,
      href,
      rootPath: activeVaultRootPath
    })
    if (!assetPath || !/\.(avif|gif|jpe?g|png|svg|webp)$/i.test(assetPath)) return null

    return `file://${assetPath.split('/').map(encodeURIComponent).join('/')}`
  }

  const saveFile = async (): Promise<void> => {
    const nextContent = editorRef.current?.getValue() ?? content
    if (!activeVault || !selectedFile || nextContent === savedContent) return

    setIsSaving(true)
    setError(null)

    try {
      const savedFile = await window.api.vault.saveMarkdownFile({
        content: nextContent,
        filePath: selectedFile.path,
        rootPath: activeVault.rootPath
      })
      setFile(savedFile)
      setContent(savedFile.content)
      setSavedContent(savedFile.content)
      onDirtyChange(false)
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
            {saveStateLabel} · {stats.words} words · {stats.characters} chars · Ln {stats.line}, Col{' '}
            {stats.column}
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

      <div className="vault-editor-toolbar" aria-label="Markdown tools">
        <button type="button" title="Bold" onClick={() => editorRef.current?.toggleBold()}>
          B
        </button>
        <button type="button" title="Italic" onClick={() => editorRef.current?.toggleItalic()}>
          I
        </button>
        <button type="button" title="Link" onClick={() => editorRef.current?.insertLink()}>
          Link
        </button>
        <button type="button" title="Image" onClick={() => editorRef.current?.insertImage()}>
          Image
        </button>
        <button type="button" title="Task list" onClick={() => editorRef.current?.toggleTaskList()}>
          Task
        </button>
        <button type="button" title="Heading 1" onClick={() => editorRef.current?.toggleHeading(1)}>
          H1
        </button>
        <button type="button" title="Heading 2" onClick={() => editorRef.current?.toggleHeading(2)}>
          H2
        </button>
        <div className="vault-editor-mode-toggle" aria-label="Editor mode">
          <button
            className={editorMode === 'raw' ? 'vault-editor-mode-toggle--active' : undefined}
            type="button"
            onClick={() => setEditorMode('raw')}
          >
            Raw
          </button>
          <button
            className={editorMode === 'rendered' ? 'vault-editor-mode-toggle--active' : undefined}
            type="button"
            onClick={() => setEditorMode('rendered')}
          >
            Rendered
          </button>
        </div>
      </div>

      {loadState === 'loading' && <div className="vault-empty-state">Opening file...</div>}
      {error && <div className="vault-error-state">{error}</div>}

      {loadState === 'ready' && selectedFile && (
        <div className="vault-editor-body">
          <MarkdownEditor
            key={`${selectedFile.path}:${editorMode}`}
            ref={editorRef}
            filePath={selectedFile.path}
            getInitialState={getPersistedEditorState}
            initialValue={content}
            onChange={changeContent}
            onOpenLink={openMarkdownLink}
            onOpenWikiLink={(target) => {
              void openWikiLink(target)
            }}
            onPersistState={persistEditorState}
            onSave={saveFile}
            onStatsChange={setStats}
            onTableOfContentsChange={setTableOfContents}
            renderedMode={editorMode === 'rendered'}
            resolveImageSource={resolveImageSource}
          />

          <aside className="vault-outline" aria-label="Document outline">
            <div className="vault-outline-header">Outline</div>
            {tableOfContents.length === 0 ? (
              <div className="vault-outline-empty">No headings</div>
            ) : (
              <ul>
                {tableOfContents.map((item) => (
                  <li key={`${item.from}-${item.title}`}>
                    <button
                      type="button"
                      style={{ paddingLeft: `${(item.level - 1) * 10 + 8}px` }}
                      onClick={() => editorRef.current?.scrollToOffset(item.from)}
                    >
                      <span>{item.title}</span>
                      <small>{item.line}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
