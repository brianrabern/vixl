import type { OAuthClientProvider } from '@ai-sdk/mcp'
import type { McpHttpServer, McpServerConfig } from '@/types/vixl/mcp-config'
import {
  getMcpAuthMode,
  isMcpHttpServer,
  isMcpStdioServer,
} from '@/types/vixl/mcp-config'
import { isAllowedMcpUrl } from '@/services/mcp/is-allowed-mcp-url'
import { assertSafeMcpEnvOverlay } from '@/services/mcp/mcp-dangerous-env'
import {
  hasHttpServer,
  logoutHttpServer,
  markHttpAuthRequired,
  refreshHttpServer,
  startHttpServer,
  stopHttpServer,
} from '@/services/mcp/mcp-http-client'
import {
  resolveMcpTemplateEnv,
  resolveOAuthClientSecret,
  resolveServerTemplates,
} from '@/services/mcp/resolve-mcp-inputs'
import {
  mcpLogout,
  mcpRefresh,
  mcpStart,
  mcpStop,
  type McpServerState,
} from '@/services/vixl/vixl-tauri'
import { assertServerTrusted, clearServerSecrets } from './trust'
import { createTokenProvider } from './oauth'
import type { McpRuntimeOptions } from './types'

export const startHttp = async (
  serverId: string,
  config: McpHttpServer,
  options?: McpRuntimeOptions,
  authProvider?: OAuthClientProvider,
): Promise<McpServerState> => {
  assertServerTrusted(serverId, config, options)

  const scopeKey = options?.scopeKey
  const authMode = getMcpAuthMode(config)
  let url = config.url
  let headers: Record<string, string> | undefined
  let clientSecret: string | undefined
  try {
    const env = await resolveMcpTemplateEnv(config)
    const resolved = await resolveServerTemplates(serverId, config, env)
    if (resolved.url) {
      url = resolved.url
    }
    headers = resolved.headers
    if (authMode === 'oauth' && !authProvider) {
      clientSecret = await resolveOAuthClientSecret(serverId, config)
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Missing MCP inputs')
    ) {
      markHttpAuthRequired(serverId, config, 'auth_required:inputs', scopeKey)
      throw new Error('auth_required:inputs')
    }
    throw error
  }

  if (!isAllowedMcpUrl(url)) {
    throw new Error(
      'MCP URL must use https, or http on localhost / 127.0.0.1',
    )
  }

  const resolvedConfig: McpHttpServer = {
    ...config,
    url,
    headers,
  }

  let provider = authProvider
  if (authMode !== 'headers' && !provider) {
    provider = createTokenProvider(
      serverId,
      resolvedConfig,
      'http://127.0.0.1/oauth-pending',
      async () => {
        throw new Error('OAuth redirect requires authenticate()')
      },
      options?.confirmAuthorizationServerOrigin,
      false,
      clientSecret,
    )
  }

  try {
    const state = await startHttpServer(serverId, resolvedConfig, {
      ...(provider ? { authProvider: provider } : {}),
      scopeKey,
    })
    if (
      state.status === 'auth_required' &&
      getMcpAuthMode(resolvedConfig) === 'headers'
    ) {
      return markHttpAuthRequired(
        serverId,
        resolvedConfig,
        'auth_required:inputs',
        scopeKey,
      )
    }
    return state
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      /unauthorized|401|auth_required|not confirmed|oauth redirect requires authenticate/i.test(
        message,
      ) ||
      error instanceof Error && error.name === 'UnauthorizedError'
    ) {
      const mappedMessage =
        authMode === 'headers' ? 'auth_required:inputs' : message
      return markHttpAuthRequired(
        serverId,
        resolvedConfig,
        mappedMessage,
        scopeKey,
      )
    }
    throw error
  }
}

export const startStdio = async (
  serverId: string,
  config: Extract<McpServerConfig, { command: string }>,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  assertServerTrusted(serverId, config, options)

  let command = config.command
  let args = config.args ?? []
  let serverEnv: Record<string, string> | undefined
  try {
    const env = await resolveMcpTemplateEnv(config)
    const resolved = await resolveServerTemplates(serverId, config, env)
    if (resolved.command) {
      command = resolved.command
    }
    if (resolved.args) {
      args = resolved.args
    }
    if (resolved.serverEnv) {
      serverEnv = assertSafeMcpEnvOverlay(resolved.serverEnv)
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Missing MCP inputs')
    ) {
      throw new Error('auth_required:inputs')
    }
    throw error
  }

  return mcpStart(
    serverId,
    command,
    args,
    serverEnv,
    options?.scopeKey ?? undefined,
    config.envFile,
  )
}

export const start = async (
  serverId: string,
  config: McpServerConfig,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  if (isMcpHttpServer(config)) {
    return startHttp(serverId, config, options)
  }
  if (isMcpStdioServer(config)) {
    return startStdio(serverId, config, options)
  }
  throw new Error('Unsupported MCP server config')
}

export const stop = async (
  serverId: string,
  config?: McpServerConfig,
  scopeKey?: string | null,
): Promise<void> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId, scopeKey)) {
    await stopHttpServer(serverId, scopeKey)
    return
  }
  await mcpStop(serverId, scopeKey ?? undefined)
}

export const refresh = async (
  serverId: string,
  config?: McpServerConfig,
  scopeKey?: string | null,
): Promise<McpServerState> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId, scopeKey)) {
    return refreshHttpServer(serverId, scopeKey)
  }
  return mcpRefresh(serverId, scopeKey ?? undefined)
}

export const logout = async (
  serverId: string,
  config?: McpServerConfig,
  scopeKey?: string | null,
): Promise<void> => {
  await clearServerSecrets(serverId, config)

  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId, scopeKey)) {
    await logoutHttpServer(
      serverId,
      config && isMcpHttpServer(config) ? config : undefined,
      scopeKey,
    )
    return
  }

  await mcpLogout(serverId, scopeKey ?? undefined)
}
