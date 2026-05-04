import { useMemo, useState } from 'react'
import type { Project, PromptTemplate } from '../../../shared/workspace'
import {
  getPromptTemplatesForProject,
  renderPromptTemplate,
  type PromptTemplateRenderContext
} from '../app/promptTemplates'
import { IconOnlyButton } from './ui/IconButtons'

type PromptTemplatePickerModalProps = {
  activeProject: Project | null
  canSend: boolean
  onClose: () => void
  onSendPrompt: (prompt: string) => void
  renderContext: PromptTemplateRenderContext
  sendStatusMessage: string
  templates: PromptTemplate[]
}

function getTemplateScopeLabel(template: PromptTemplate, activeProject: Project | null): string {
  if (template.scope === 'global') return 'Global'
  if (activeProject && template.projectId === activeProject.id) return activeProject.name

  return 'Project'
}

export function PromptTemplatePickerModal({
  activeProject,
  canSend,
  onClose,
  onSendPrompt,
  renderContext,
  sendStatusMessage,
  templates
}: PromptTemplatePickerModalProps): React.JSX.Element {
  const availableTemplates = useMemo(
    () => getPromptTemplatesForProject(templates, activeProject?.id),
    [activeProject?.id, templates]
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    availableTemplates[0]?.id ?? null
  )
  const selectedTemplate =
    availableTemplates.find((template) => template.id === selectedTemplateId) ??
    availableTemplates[0] ??
    null
  const renderedPrompt = selectedTemplate
    ? renderPromptTemplate(selectedTemplate.body, renderContext)
    : ''
  const canSendSelected = Boolean(canSend && selectedTemplate && renderedPrompt.trim())

  const sendRenderedPrompt = (prompt: string): void => {
    if (!canSend || !prompt.trim()) return

    onSendPrompt(prompt)
    onClose()
  }

  const sendSelectedPrompt = (): void => {
    if (!canSendSelected) return

    sendRenderedPrompt(renderedPrompt)
  }

  return (
    <div className="modal-backdrop">
      <section className="modal modal--wide prompt-picker-modal" aria-label="Prompt templates">
        <header className="modal-header">
          <div>
            <h2>Send prompt</h2>
            <p className="modal-subtitle">{sendStatusMessage}</p>
          </div>
          <IconOnlyButton
            className="modal-close-button"
            label="Close prompt templates"
            onClick={onClose}
          >
            X
          </IconOnlyButton>
        </header>

        <div className="prompt-picker-layout">
          <div className="prompt-picker-list" aria-label="Available prompts">
            {availableTemplates.length === 0 && (
              <div className="empty-start-state">No templates for this workspace.</div>
            )}

            {availableTemplates.map((template) => (
              <button
                key={template.id}
                className={`prompt-picker-item${
                  template.id === selectedTemplate?.id ? ' prompt-picker-item--active' : ''
                }`}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(template.id)
                  sendRenderedPrompt(renderPromptTemplate(template.body, renderContext))
                }}
              >
                <small>{getTemplateScopeLabel(template, activeProject)}</small>
                <strong>{template.name}</strong>
                {template.description && <span>{template.description}</span>}
              </button>
            ))}
          </div>

          <div className="prompt-preview-panel">
            <span>Preview</span>
            <pre>{renderedPrompt || 'Select a prompt template.'}</pre>
          </div>
        </div>

        <footer className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!canSendSelected}
            onClick={sendSelectedPrompt}
          >
            Send prompt
          </button>
        </footer>
      </section>
    </div>
  )
}
