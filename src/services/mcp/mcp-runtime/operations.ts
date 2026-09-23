import type { McpServerConfig } from '@/types/vixl/mcp-config'
import { getMcpAuthMode, isMcpHttpServer } from '@/types/vixl/mcp-config'
import {
  getHttpPrompt,
  getHttpState,
  hasHttpServer,
  listHttpResources,
  listHttpStates,
  readHttpResource,
} from '@/services/mcp/mcp-http-client'
import {
  mcpCallTool,
  mcpListStatuses,
  mcpStatus,
  type McpServerState,
} from '@/services/vixl/vixl-tauri'
import connectionKey from '@/services/mcp/connection-key'
import { start } from './lifecycle'
import type { McpRuntimeOptions } from './types'
import callHttpToolWithStepUp from './step-up'
import { runAuthenticateHttp } from './authenticate-http'

export { cancelAuthenticate } from './authenticate-http'

const oauthInFlight = new Map<string, Promise<McpServerState>>()

export const authenticate = async (
  serverId: string,
  config: McpServerConfig,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  if (!isMcpHttpServer(config)) {
    return start(serverId, config, options)
  }

  const authMode = getMcpAuthMode(config)
  if (authMode === 'headers') {
    return start(serverId, config, options)
  }

  const flowId = connectionKey(options?.scopeKey, serverId)
  const existing = oauthInFlight.get(flowId)
  if (existing) {
    return existing
  }

  const flight = runAuthenticateHttp(serverId, config, options).finally(() => {
    oauthInFlight.delete(flowId)
  })
  oauthInFlight.set(flowId, flight)
  return flight
}

export const callTool = async (
  serverId: string,
  tool: string,
  args: Record<string, unknown>,
  config?: McpServerConfig,
  scopeKey?: string | null,
): Promise<unknown> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId, scopeKey)) {
    return callHttpToolWithStepUp(
      serverId,
      tool,
      args,
      config,
      authenticate,
      scopeKey,
    )
  }
  return mcpCallTool(serverId, tool, args, scopeKey ?? undefined)
}

const statusConnectionKey = (
  key: string,
  state: McpServerState,
): string => {
  const scoped = state as McpServerState & { scopeKey?: string }
  if (scoped.scopeKey) {
    return connectionKey(scoped.scopeKey, state.serverId)
  }
  if (key.includes('\u001f')) {
    return key
  }
  return connectionKey(undefined, state.serverId)
}

export const listStatuses = async (
  scopeKey?: string | null,
): Promise<Record<string, McpServerState>> => {
  const stdio = await mcpListStatuses(scopeKey ?? undefined)
  const merged: Record<string, McpServerState> = {}
  for (const [key, state] of Object.entries(stdio)) {
    merged[statusConnectionKey(key, state)] = state
  }
  for (const [key, state] of Object.entries(listHttpStates())) {
    merged[statusConnectionKey(key, state)] = state
  }
  return merged
}

export const getStatus = async (
  serverId: string,
  config?: McpServerConfig,
  scopeKey?: string | null,
): Promise<McpServerState> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId, scopeKey)) {
    const httpState = getHttpState(serverId, scopeKey)
    if (httpState) {
      return httpState
    }
    return {
      serverId,
      status: 'stopped',
      tools: [],
      error: null,
    }
  }
  return mcpStatus(serverId, scopeKey ?? undefined)
}

export const listResources = async (
  serverId: string,
  scopeKey?: string | null,
): Promise<unknown> => {
  if (!hasHttpServer(serverId, scopeKey)) {
    throw new Error('MCP resources require a connected HTTP or SSE server')
  }
  return listHttpResources(serverId, scopeKey)
}

export const readResource = async (
  serverId: string,
  uri: string,
  scopeKey?: string | null,
): Promise<unknown> => {
  if (!hasHttpServer(serverId, scopeKey)) {
    throw new Error('MCP resources require a connected HTTP or SSE server')
  }
  return readHttpResource(serverId, uri, scopeKey)
}

export const getPrompt = async (
  serverId: string,
  name: string,
  promptArgs?: Record<string, unknown>,
  scopeKey?: string | null,
): Promise<unknown> => {
  if (!hasHttpServer(serverId, scopeKey)) {
    throw new Error('MCP prompts require a connected HTTP or SSE server')
  }
  return getHttpPrompt(serverId, name, promptArgs, scopeKey)
}
