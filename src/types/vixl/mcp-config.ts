export type McpStdioServer = {
  command: string
  args?: string[]
  env?: Record<string, string>
  envFile?: string
  enabled?: boolean
  oauth?: never
}

export type McpOAuthConfig = {
  clientId?: string
  allowedAuthorizationServers?: string[]
  clientSecret?: string
  scopes?: string[]
  callbackPort?: number
  authServerMetadataUrl?: string
}

export type McpHttpServer = {
  type: 'http' | 'sse'
  url: string
  auth?: 'none' | 'headers' | 'oauth'
  headers?: Record<string, string>
  oauth?: McpOAuthConfig
  enabled?: boolean
}

export type McpServerConfig = McpStdioServer | McpHttpServer

export type McpInputDefinition = {
  id: string
  type: 'promptString'
  description?: string
  password?: boolean
}

export type McpConfig = {
  servers: Record<string, McpServerConfig>
  inputs?: McpInputDefinition[]
}

export type ParseMcpConfigResult =
  | { ok: true; config: McpConfig }
  | { ok: false; error: string }

export type McpServerScope = 'personal' | 'project' | 'overridden'

export type McpServerStatus =
  | 'connected'
  | 'starting'
  | 'stopped'
  | 'error'
  | 'auth_required'
  | 'refreshing'

export const isMcpStdioServer = (
  config: McpServerConfig,
): config is McpStdioServer => 'command' in config

export const isMcpHttpServer = (
  config: McpServerConfig,
): config is McpHttpServer => 'type' in config && (config.type === 'http' || config.type === 'sse')

export const getMcpAuthMode = (
  config: McpServerConfig,
): 'none' | 'headers' | 'oauth' => {
  if (!isMcpHttpServer(config)) {
    return 'none'
  }
  if (config.auth !== undefined) {
    return config.auth
  }
  if (config.oauth !== undefined) {
    return 'oauth'
  }
  if (config.headers !== undefined && Object.keys(config.headers).length > 0) {
    return 'headers'
  }
  return 'oauth'
}

export const canOfferMcpOAuthLogin = (config: McpServerConfig): boolean => {
  if (!isMcpHttpServer(config)) {
    return false
  }
  const mode = getMcpAuthMode(config)
  return mode === 'oauth' || mode === 'none'
}

export const isMcpAuthRequiredInputsError = (error?: string | null): boolean =>
  typeof error === 'string' && error.includes('auth_required:inputs')

export const canShowMcpOAuthLoginControl = (
  config: McpServerConfig,
  status: string,
  error?: string | null,
): boolean =>
  status === 'auth_required' &&
  canOfferMcpOAuthLogin(config) &&
  !isMcpAuthRequiredInputsError(error)
