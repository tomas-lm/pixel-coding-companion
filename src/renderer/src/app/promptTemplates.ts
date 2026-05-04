import type {
  PromptTemplate,
  PromptTemplateScope,
  RunningSession,
  TerminalConfig
} from '../../../shared/workspace'
import { isLiveSession } from './sessionDisplay'

export type PromptTemplateForm = {
  body: string
  createdAt?: string
  description: string
  id?: string
  name: string
  scope: PromptTemplateScope
}

export type PromptTemplateRenderContext = {
  projectName: string
  projectPath: string
}

const REMOVED_PRESET_PROMPT_TEMPLATE_IDS = new Set([
  'preset-inspect-project',
  'preset-plan-task',
  'preset-focused-fix'
])

export function normalizePromptTemplates(templates: PromptTemplate[] = []): PromptTemplate[] {
  return templates.filter((template) => !REMOVED_PRESET_PROMPT_TEMPLATE_IDS.has(template.id))
}

export function createEmptyPromptTemplateForm(
  scope: PromptTemplateScope = 'global'
): PromptTemplateForm {
  return {
    body: '',
    description: '',
    name: '',
    scope
  }
}

export function createPromptTemplateFromForm(
  form: PromptTemplateForm,
  options: {
    createId: () => string
    now: string
    projectId?: string
  }
): PromptTemplate {
  const scope = form.scope === 'project' && options.projectId ? 'project' : 'global'

  return {
    body: form.body.trim(),
    createdAt: form.createdAt ?? options.now,
    description: form.description.trim() || undefined,
    id: form.id ?? options.createId(),
    name: form.name.trim(),
    projectId: scope === 'project' ? options.projectId : undefined,
    scope,
    updatedAt: options.now
  }
}

export function createPromptTemplateForm(template: PromptTemplate): PromptTemplateForm {
  return {
    body: template.body,
    createdAt: template.createdAt,
    description: template.description ?? '',
    id: template.id,
    name: template.name,
    scope: template.scope
  }
}

export function getPromptTemplatesForProject(
  templates: PromptTemplate[],
  projectId?: string
): PromptTemplate[] {
  return templates.filter((template) => {
    if (template.scope === 'global') return true
    return Boolean(projectId && template.projectId === projectId)
  })
}

export function getPromptTemplateProjectPath(
  activeSession: RunningSession | null,
  projectConfigs: TerminalConfig[]
): string {
  if (activeSession?.cwd) return activeSession.cwd

  return projectConfigs.find((config) => config.cwd.trim())?.cwd ?? ''
}

export function getPromptTemplateSendStatus(activeSession: RunningSession | null): {
  canSend: boolean
  message: string
} {
  if (!activeSession) {
    return {
      canSend: false,
      message: 'Start a terminal to send a prompt.'
    }
  }

  if (!isLiveSession(activeSession)) {
    return {
      canSend: false,
      message: 'Select a running terminal to send a prompt.'
    }
  }

  return {
    canSend: true,
    message: `Ready to send to ${activeSession.name}.`
  }
}

export function renderPromptTemplate(body: string, context: PromptTemplateRenderContext): string {
  return body
    .replaceAll('%project_name', context.projectName)
    .replaceAll('%project_path', context.projectPath)
}
