import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project, PromptTemplate } from '../../../shared/workspace'
import { PromptTemplatesPanel } from './PromptTemplatesPanel'

const project: Project = {
  color: '#4ea1ff',
  description: 'Main workspace',
  id: 'project-1',
  name: 'Pixel'
}

const templates: PromptTemplate[] = [
  {
    body: 'Global %project_name',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'global',
    name: 'Global prompt',
    scope: 'global',
    updatedAt: '2026-05-04T00:00:00.000Z'
  },
  {
    body: 'Project %project_path',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'project',
    name: 'Project prompt',
    projectId: project.id,
    scope: 'project',
    updatedAt: '2026-05-04T00:00:00.000Z'
  }
]

afterEach(cleanup)

describe('PromptTemplatesPanel', () => {
  it('renders global and active project templates', () => {
    render(
      <PromptTemplatesPanel
        activeProject={project}
        templates={templates}
        onDeleteTemplate={vi.fn()}
        onSaveTemplate={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Prompts' })).toBeInTheDocument()
    expect(screen.getByText('Global prompt')).toBeInTheDocument()
    expect(screen.getByText('Project prompt')).toBeInTheDocument()
  })

  it('creates a global prompt template', () => {
    const onSaveTemplate = vi.fn()

    render(
      <PromptTemplatesPanel
        activeProject={project}
        templates={templates}
        onDeleteTemplate={vi.fn()}
        onSaveTemplate={onSaveTemplate}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Global prompt' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Review' } })
    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Review %project_name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save prompt' }))

    expect(onSaveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Review %project_name',
        name: 'Review',
        scope: 'global'
      })
    )
  })
})
