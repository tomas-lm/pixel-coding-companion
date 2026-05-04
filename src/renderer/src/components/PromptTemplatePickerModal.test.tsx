import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project, PromptTemplate } from '../../../shared/workspace'
import { PromptTemplatePickerModal } from './PromptTemplatePickerModal'

const project: Project = {
  color: '#4ea1ff',
  description: 'Main workspace',
  id: 'project-1',
  name: 'Pixel'
}

const templates: PromptTemplate[] = [
  {
    body: 'Open %project_name at %project_path',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'global',
    name: 'Inspect',
    scope: 'global',
    updatedAt: '2026-05-04T00:00:00.000Z'
  }
]

afterEach(cleanup)

describe('PromptTemplatePickerModal', () => {
  it('renders a variable-substituted preview', () => {
    render(
      <PromptTemplatePickerModal
        activeProject={project}
        canSend
        renderContext={{ projectName: 'Pixel', projectPath: '/repo' }}
        sendStatusMessage="Ready"
        templates={templates}
        onClose={vi.fn()}
        onSendPrompt={vi.fn()}
      />
    )

    expect(screen.getByText('Open Pixel at /repo')).toBeInTheDocument()
  })

  it('sends the selected rendered prompt', () => {
    const onClose = vi.fn()
    const onSendPrompt = vi.fn()

    render(
      <PromptTemplatePickerModal
        activeProject={project}
        canSend
        renderContext={{ projectName: 'Pixel', projectPath: '/repo' }}
        sendStatusMessage="Ready"
        templates={templates}
        onClose={onClose}
        onSendPrompt={onSendPrompt}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }))

    expect(onSendPrompt).toHaveBeenCalledWith('Open Pixel at /repo')
    expect(onClose).toHaveBeenCalled()
  })

  it('sends a rendered prompt when a template is clicked', () => {
    const onClose = vi.fn()
    const onSendPrompt = vi.fn()

    render(
      <PromptTemplatePickerModal
        activeProject={project}
        canSend
        renderContext={{ projectName: 'Pixel', projectPath: '/repo' }}
        sendStatusMessage="Ready"
        templates={templates}
        onClose={onClose}
        onSendPrompt={onSendPrompt}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Inspect/ }))

    expect(onSendPrompt).toHaveBeenCalledWith('Open Pixel at /repo')
    expect(onClose).toHaveBeenCalled()
  })

  it('disables send when the active terminal cannot receive input', () => {
    render(
      <PromptTemplatePickerModal
        activeProject={project}
        canSend={false}
        renderContext={{ projectName: 'Pixel', projectPath: '/repo' }}
        sendStatusMessage="Start a terminal to send a prompt."
        templates={templates}
        onClose={vi.fn()}
        onSendPrompt={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Send prompt' })).toBeDisabled()
    expect(screen.getByText('Start a terminal to send a prompt.')).toBeInTheDocument()
  })
})
