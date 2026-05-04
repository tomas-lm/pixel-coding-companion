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

const DEFAULT_PROMPT_TEMPLATE_TIMESTAMP = '2026-05-04T00:00:00.000Z'

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    body: 'Explore o projeto %project_name em %project_path, entenda a estrutura e me diga quando estiver pronto para programar.',
    createdAt: DEFAULT_PROMPT_TEMPLATE_TIMESTAMP,
    description: 'Primeira leitura antes de implementar.',
    id: 'preset-inspect-project',
    name: 'Inspect project',
    scope: 'global',
    updatedAt: DEFAULT_PROMPT_TEMPLATE_TIMESTAMP
  },
  {
    body: 'Leia o contexto do projeto %project_name em %project_path e transforme a ideia abaixo em uma task clara antes de programar:',
    createdAt: DEFAULT_PROMPT_TEMPLATE_TIMESTAMP,
    description: 'Transforma ideia em tarefa de implementação.',
    id: 'preset-plan-task',
    name: 'Plan task',
    scope: 'global',
    updatedAt: DEFAULT_PROMPT_TEMPLATE_TIMESTAMP
  },
  {
    body: 'No projeto %project_name em %project_path, investigue o problema abaixo, implemente a correcao mais enxuta e valide com testes focados:',
    createdAt: DEFAULT_PROMPT_TEMPLATE_TIMESTAMP,
    description: 'Correção focada com validação.',
    id: 'preset-focused-fix',
    name: 'Focused fix',
    scope: 'global',
    updatedAt: DEFAULT_PROMPT_TEMPLATE_TIMESTAMP
  }
]

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
