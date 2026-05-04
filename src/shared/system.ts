export const SYSTEM_CHANNELS = {
  openTarget: 'system:open-target'
} as const

export type OpenTargetRequest =
  | { kind: 'external_url'; url: string }
  | { kind: 'file_url'; url: string }
  | { kind: 'file_path'; path: string; cwd?: string; line?: number; column?: number }

export type OpenTargetResult =
  | { ok: true; resolvedTarget?: string }
  | { ok: false; reason: 'unsupported_protocol' | 'not_found' | 'invalid_target' | 'open_failed' }

export type ClipboardApi = {
  writeText: (text: string) => void
}

export type SystemApi = {
  openTarget: (request: OpenTargetRequest) => Promise<OpenTargetResult>
}
