import { call } from './helpers'
import type { HttpProxyRequest, McpServerState, OAuthLoopbackStart } from './types'

export const openExternalUrl = (
  url: string,
  allowedOrigin: string,
): Promise<void> => call('open_external_url', { url, allowedOrigin })

export const oauthBeginLoopback = (
  flowId: string,
  port?: number,
): Promise<OAuthLoopbackStart> =>
  call('oauth_begin_loopback', { flowId, port: port ?? null })

export const oauthCancelLoopback = (flowId: string): Promise<void> =>
  call('oauth_cancel_loopback', { flowId })

export const getEnvVars = (names: string[]): Promise<Record<string, string>> =>
  call('get_env_vars', { names })

export const mcpStart = (
  serverId: string,
  command: string,
  args: string[],
  env?: Record<string, string>,
  scopeKey?: string,
  envFile?: string,
): Promise<McpServerState> =>
  call('mcp_start', {
    serverId,
    command,
    args,
    env: env ?? null,
    scopeKey: scopeKey ?? null,
    envFile: envFile ?? null,
  })

export const mcpStop = (serverId: string, scopeKey?: string): Promise<void> =>
  call('mcp_stop', { serverId, scopeKey: scopeKey ?? null })

export const mcpRefresh = (serverId: string, scopeKey?: string): Promise<McpServerState> =>
  call('mcp_refresh', { serverId, scopeKey: scopeKey ?? null })

export const mcpLogout = (serverId: string, scopeKey?: string): Promise<void> =>
  call('mcp_logout', { serverId, scopeKey: scopeKey ?? null })

export const mcpStatus = (serverId: string, scopeKey?: string): Promise<McpServerState> =>
  call('mcp_status', { serverId, scopeKey: scopeKey ?? null })

export const mcpListStatuses = (
  scopeKey?: string,
): Promise<Record<string, McpServerState>> =>
  call('mcp_list_statuses', { scopeKey: scopeKey ?? null })

export const httpProxyRequest = (
  request: HttpProxyRequest,
): Promise<{ status: number; body: string; headers: Record<string, string> }> =>
  call('http_proxy_request', { request })

export const mcpCallTool = (
  serverId: string,
  tool: string,
  args: Record<string, unknown>,
  scopeKey?: string,
): Promise<unknown> =>
  call('mcp_call_tool', { serverId, tool, args, scopeKey: scopeKey ?? null })
