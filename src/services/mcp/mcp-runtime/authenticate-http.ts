import { auth } from '@ai-sdk/mcp'
import type { McpHttpServer } from '@/types/vixl/mcp-config'
import {
  getHttpOauthChallenge,
  markHttpAuthRequired,
  setHttpLastRequestedScope,
} from '@/services/mcp/mcp-http-client'
import {
  mcpOAuthFetch,
  withAuthServerMetadataUrl,
} from '@/services/mcp/mcp-oauth-fetch'
import {
  oauthBeginLoopback,
  oauthCancelLoopback,
  openExternalUrl,
  type McpServerState,
} from '@/services/vixl/vixl-tauri'
import {
  applyOAuthCallback,
  getLastOAuthChallenge,
  unionScopes,
} from '@/services/mcp/oauth'
import { isAllowedMcpUrl } from '@/services/mcp/is-allowed-mcp-url'
import {
  resolveMcpTemplateEnv,
  resolveOAuthClientSecret,
  resolveServerTemplates,
} from '@/services/mcp/resolve-mcp-inputs'
import connectionKey from '@/services/mcp/connection-key'
import { assertServerTrusted } from './trust'
import { createTokenProvider, waitForOAuthCallback } from './oauth'
import { startHttp } from './lifecycle'
import type { McpRuntimeOptions } from './types'

const oauthAbortControllers = new Map<string, AbortController>()

const isOAuthCallbackAborted = (error: unknown): boolean =>
  error instanceof Error && error.message === 'OAuth callback aborted'

const beginOAuthLoopback = (
  flowId: string,
  port?: number,
): ReturnType<typeof oauthBeginLoopback> =>
  port !== undefined
    ? oauthBeginLoopback(flowId, port)
    : oauthBeginLoopback(flowId)

export const cancelAuthenticate = (
  serverId: string,
  scopeKey?: string | null,
): boolean => {
  const controller = oauthAbortControllers.get(connectionKey(scopeKey, serverId))
  if (!controller) {
    return false
  }
  controller.abort()
  return true
}

export const runAuthenticateHttp = async (
  serverId: string,
  config: McpHttpServer,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  assertServerTrusted(serverId, config, options)

  const scopeKey = options?.scopeKey
  let resolvedConfig = config
  let clientSecret: string | undefined
  try {
    const env = await resolveMcpTemplateEnv(config)
    const resolved = await resolveServerTemplates(serverId, config, env)
    resolvedConfig = {
      ...config,
      url: resolved.url ?? config.url,
      headers: resolved.headers,
    }
    clientSecret = await resolveOAuthClientSecret(serverId, config)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Missing MCP inputs')
    ) {
      markHttpAuthRequired(
        serverId,
        config,
        'auth_required:inputs',
        options?.scopeKey,
      )
      throw new Error('auth_required:inputs')
    }
    throw error
  }

  if (!isAllowedMcpUrl(resolvedConfig.url)) {
    throw new Error(
      'MCP URL must use https, or http on localhost / 127.0.0.1',
    )
  }

  const flowId = connectionKey(scopeKey, serverId)
  const loopback = await beginOAuthLoopback(
    flowId,
    resolvedConfig.oauth?.callbackPort,
  )
  const abort = new AbortController()
  oauthAbortControllers.set(flowId, abort)
  const callbackPromise = waitForOAuthCallback(abort.signal, flowId)

  let result: McpServerState | undefined
  let failure: unknown

  try {
    const provider = createTokenProvider(
      serverId,
      resolvedConfig,
      loopback.redirectUrl,
      async (url: string, allowedOrigin: string) => {
        await openExternalUrl(url, allowedOrigin)
      },
      options?.confirmAuthorizationServerOrigin,
      true,
      clientSecret,
    )

    const challenge =
      getHttpOauthChallenge(serverId, scopeKey) ??
      getLastOAuthChallenge(resolvedConfig.url)
    const configuredScope =
      resolvedConfig.oauth?.scopes && resolvedConfig.oauth.scopes.length > 0
        ? resolvedConfig.oauth.scopes.join(' ')
        : undefined
    const scope =
      unionScopes(configuredScope, options?.scope ?? challenge?.scope) ||
      undefined
    const resourceMetadataUrl =
      options?.resourceMetadataUrl ?? challenge?.resourceMetadataUrl
    if (scope) {
      setHttpLastRequestedScope(serverId, scope, scopeKey)
    }

    const authBase = {
      serverUrl: resolvedConfig.url,
      fetchFn: withAuthServerMetadataUrl(
        mcpOAuthFetch,
        resolvedConfig.oauth?.authServerMetadataUrl,
      ),
      scope,
      resourceMetadataUrl,
    }

    const first = await auth(provider, authBase)
    if (first === 'REDIRECT') {
      const callback = await callbackPromise
      const exchange = await applyOAuthCallback(provider, callback)
      const second = await auth(provider, {
        ...authBase,
        authorizationCode: exchange.authorizationCode,
        callbackState: exchange.callbackState,
        callbackIssuer: exchange.callbackIssuer,
      })
      if (second !== 'AUTHORIZED') {
        throw new Error('OAuth authorization did not complete')
      }
    } else if (first !== 'AUTHORIZED') {
      throw new Error('OAuth authorization did not complete')
    } else {
      abort.abort()
      try {
        await callbackPromise
      } catch (callbackError) {
        if (!isOAuthCallbackAborted(callbackError)) {
          throw callbackError
        }
      }
    }

    result = await startHttp(serverId, resolvedConfig, options, provider)
  } catch (error) {
    abort.abort()
    try {
      await callbackPromise
    } catch (callbackError) {
      if (!isOAuthCallbackAborted(callbackError)) {
        failure = callbackError
      }
    }
    if (failure === undefined) {
      markHttpAuthRequired(
        serverId,
        resolvedConfig,
        error instanceof Error ? error.message : 'Authentication failed',
        options?.scopeKey,
      )
      failure = error
    }
  } finally {
    oauthAbortControllers.delete(flowId)
    try {
      await oauthCancelLoopback(flowId)
    } catch (cancelError) {
      if (!(cancelError instanceof Error) && failure === undefined) {
        failure = cancelError
      }
    }
  }

  if (failure !== undefined) {
    throw failure
  }

  if (result === undefined) {
    throw new Error('OAuth authorization did not complete')
  }

  return result
}
