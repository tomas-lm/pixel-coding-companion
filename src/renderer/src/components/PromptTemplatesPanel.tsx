import { useMemo, useState } from 'react'
import type { Project, PromptTemplate } from '../../../shared/workspace'
import {
  createEmptyPromptTemplateForm,
  createPromptTemplateForm,
  createPromptTemplateFromForm,
  type PromptTemplateForm
} from '../app/promptTemplates'
import { AddButton, IconOnlyButton } from './ui/IconButtons'

type PromptTemplatesPanelProps = {
  activeProject: Project | null
  onDeleteTemplate: (templateId: string) => void
  onSaveTemplate: (template: PromptTemplate) => void
  templates: PromptTemplate[]
}

function getScopeLabel(template: PromptTemplate, activeProject: Project | null): string {
  if (template.scope === 'global') return 'Global'
  if (activeProject && template.projectId === activeProject.id) return activeProject.name

  return 'Project'
}

export function PromptTemplatesPanel({
  activeProject,
  onDeleteTemplate,
  onSaveTemplate,
  templates
}: PromptTemplatesPanelProps): React.JSX.Element {
  const [form, setForm] = useState<PromptTemplateForm | null>(null)
  const scopedTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (template.scope === 'global') return true
        return Boolean(activeProject && template.projectId === activeProject.id)
      }),
    [activeProject, templates]
  )
  const canSave = Boolean(form?.name.trim() && form.body.trim())

  const saveForm = (): void => {
    if (!form || !canSave) return

    onSaveTemplate(
      createPromptTemplateFromForm(form, {
        createId: () => `prompt-template-${crypto.randomUUID()}`,
        now: new Date().toISOString(),
        projectId: activeProject?.id
      })
    )
    setForm(null)
  }

  return (
    <section className="prompt-templates-panel" aria-label="Prompt templates">
      <header className="prompt-templates-header">
        <div>
          <span className="eyebrow">{activeProject?.name ?? 'Pixel Companion'}</span>
          <h1>Prompts</h1>
        </div>
        <div className="prompt-template-actions">
          <AddButton
            className="secondary-button"
            label="Global prompt"
            onClick={() => setForm(createEmptyPromptTemplateForm('global'))}
          />
          <AddButton
            className="primary-button"
            label="Project prompt"
            disabled={!activeProject}
            onClick={() => setForm(createEmptyPromptTemplateForm('project'))}
          />
        </div>
      </header>

      <div className="prompt-template-grid">
        {scopedTemplates.length === 0 && (
          <div className="prompt-template-empty">No prompt templates configured.</div>
        )}

        {scopedTemplates.map((template) => (
          <article key={template.id} className="prompt-template-card">
            <header>
              <div>
                <small>{getScopeLabel(template, activeProject)}</small>
                <h2>{template.name}</h2>
              </div>
              <div className="prompt-template-card-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setForm(createPromptTemplateForm(template))}
                >
                  Edit
                </button>
                <IconOnlyButton
                  className="danger-button"
                  label={`Delete ${template.name}`}
                  onClick={() => onDeleteTemplate(template.id)}
                >
                  X
                </IconOnlyButton>
              </div>
            </header>
            {template.description && <p>{template.description}</p>}
            <pre>{template.body}</pre>
          </article>
        ))}
      </div>

      {form && (
        <div className="modal-backdrop">
          <section className="modal modal--wide" aria-label="Prompt template settings">
            <header className="modal-header">
              <h2>{form.id ? 'Edit prompt' : 'Add prompt'}</h2>
              <IconOnlyButton
                className="modal-close-button"
                label="Close prompt settings"
                onClick={() => setForm(null)}
              >
                X
              </IconOnlyButton>
            </header>

            <label>
              <span>Name</span>
              <input
                value={form.name}
                autoFocus
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              <span>Description</span>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <label>
              <span>Scope</span>
              <select
                value={form.scope}
                onChange={(event) =>
                  setForm({
                    ...form,
                    scope: event.target.value === 'project' ? 'project' : 'global'
                  })
                }
              >
                <option value="global">Global</option>
                <option value="project" disabled={!activeProject}>
                  Project
                </option>
              </select>
            </label>
            <label>
              <span>Prompt</span>
              <textarea
                rows={9}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
            </label>

            <footer className="modal-actions modal-actions--end">
              <button className="secondary-button" type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!canSave}
                onClick={saveForm}
              >
                Save prompt
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  )
}
