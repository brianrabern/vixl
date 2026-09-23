import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpHttpServer } from '@/types/vixl/mcp-config'
import type { McpServerState } from '@/services/vixl/vixl-tauri'
import { mockVixlTauri } from '../../../test-utils/mocks/vixl-tauri'

const {
  auth,
  oauthBeginLoopback,
  oauthCancelLoopback,
  waitForOAuthCallback,
  start,
  startHttp,
  markHttpAuthRequired,
  getEnvVars,
} = vi.hoisted(() => ({
  auth: vi.fn<(...args: unknown[]) => Promise<string>>(),
  oauthBeginLoopback: vi.fn<(flowId: string) => Promise<{ port: number; redirectUrl: string }>>(
    async () => ({
      port: 43721,
      redirectUrl: 'http://127.0.0.1:43721/callback',
    }),
  ),
  oauthCancelLoopback: vi.fn<(flowId: string) => Promise<void>>(async () => undefined),
  waitForOAuthCallback: vi.fn<(signal: AbortSignal, flowId: string) => Promise<never>>(
    (signal) =>
      new Promise((_, reject) => {
        const onAbort = (): void => {
          reject(new Error('OAuth callback aborted'))
        }
        if (signal.aborted) {
          onAbort()
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }),
  ),
  start: vi.fn<(...args: unknown[]) => Promise<McpServerState>>(),
  startHttp: vi.fn<(...args: unknown[]) => Promise<McpServerState>>(),
  markHttpAuthRequired: vi.fn<
    (
      serverId: string,
      config: McpHttpServer,
      error?: string | null,
      scopeKey?: string | null,
    ) => McpServerState
  >((serverId, _config, error) => ({
    serverId,
    status: 'auth_required',
    tools: [],
    error: error ?? null,
  })),
  getEnvVars: vi.fn<(names: string[]) => Promise<Record<string, string>>>(
    async () => ({}),
  ),
}))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    oauthBeginLoopback,
    oauthCancelLoopback,
    getEnvVars,
  }),
)

vi.mock('@ai-sdk/mcp', () => ({
  auth: (...args: unknown[]) => auth(...args),
}))

vi.mock('@/services/mcp/mcp-runtime/oauth', () => ({
  createTokenProvider: vi.fn<(...args: unknown[]) => Record<string, never>>(() => ({})),
  waitForOAuthCallback: (signal: AbortSignal, flowId: string) =>
    waitForOAuthCallback(signal, flowId),
}))

vi.mock('@/services/mcp/mcp-http-client', () => ({
  getHttpPrompt: vi.fn<(...args: unknown[]) => unknown>(),
  getHttpState: vi.fn<(...args: unknown[]) => unknown>(),
  hasHttpServer: vi.fn<(...args: unknown[]) => boolean>(() => false),
  listHttpResources: vi.fn<(...args: unknown[]) => unknown>(),
  listHttpStates: vi.fn<(...args: unknown[]) => Record<string, never>>(() => ({})),
  markHttpAuthRequired: (
    serverId: string,
    config: McpHttpServer,
    error?: string | null,
    scopeKey?: string | null,
  ) => markHttpAuthRequired(serverId, config, error, scopeKey),
  readHttpResource: vi.fn<(...args: unknown[]) => unknown>(),
  getHttpOauthChallenge: vi.fn<(...args: unknown[]) => undefined>(() => undefined),
  setHttpLastRequestedScope: vi.fn<(...args: unknown[]) => void>(),
}))

vi.mock('@/services/mcp/mcp-oauth-fetch', () => ({
  mcpOAuthFetch: vi.fn<(...args: unknown[]) => unknown>(),
  withAuthServerMetadataUrl: (fetchFn: unknown) => fetchFn,
}))

vi.mock('@/services/mcp/oauth', () => ({
  applyOAuthCallback: vi.fn<(...args: unknown[]) => unknown>(),
  getLastOAuthChallenge: vi.fn<(...args: unknown[]) => undefined>(() => undefined),
  unionScopes: (previous?: string, challenge?: string) =>
    [previous, challenge].filter((value) => value && value.length > 0).join(' '),
}))

vi.mock('@/services/mcp/mcp-runtime/lifecycle', () => ({
  start: (...args: unknown[]) => start(...args),
  startHttp: (...args: unknown[]) => startHttp(...args),
  stop: vi.fn<(...args: unknown[]) => unknown>(),
  refresh: vi.fn<(...args: unknown[]) => unknown>(),
  logout: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock('@/services/mcp/mcp-runtime/step-up', () => ({
  default: vi.fn<(...args: unknown[]) => unknown>(),
}))

import { authenticate } from '@/services/mcp/mcp-runtime/operations'
import connectionKey from '@/services/mcp/connection-key'

const connected: McpServerState = {
  serverId: 'github',
  status: 'connected',
  tools: [],
}

const oauthConfig: McpHttpServer = {
  type: 'http',
  url: 'https://example.com/mcp',
  auth: 'oauth',
}

const headersConfig: McpHttpServer = {
  type: 'http',
  url: 'https://example.com/mcp',
  auth: 'headers',
  headers: {
    Authorization: 'Bearer token',
  },
}

const noneConfig: McpHttpServer = {
  type: 'http',
  url: 'https://example.com/mcp',
  auth: 'none',
}

describe('authenticate auth modes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue('AUTHORIZED')
    start.mockResolvedValue(connected)
    startHttp.mockResolvedValue(connected)
    getEnvVars.mockResolvedValue({})
    markHttpAuthRequired.mockImplementation((serverId, _config, error) => ({
      serverId,
      status: 'auth_required',
      tools: [],
      error: error ?? null,
    }))
  })

  it('starts headers mode and returns the connected state', async () => {
    const state = await authenticate('github', headersConfig, {
      skipTrustCheck: true,
    })

    expect(start).toHaveBeenCalledWith('github', headersConfig, {
      skipTrustCheck: true,
    })
    expect(oauthBeginLoopback).not.toHaveBeenCalled()
    expect(markHttpAuthRequired).not.toHaveBeenCalled()
    expect(state).toEqual(connected)
    expect(state.status).not.toBe('auth_required')
  })

  it('surfaces auth_required:inputs when headers start is missing inputs', async () => {
    start.mockResolvedValueOnce({
      serverId: 'github',
      status: 'auth_required',
      tools: [],
      error: 'auth_required:inputs',
    })

    const state = await authenticate('github', headersConfig, {
      skipTrustCheck: true,
    })

    expect(start).toHaveBeenCalledWith('github', headersConfig, {
      skipTrustCheck: true,
    })
    expect(oauthBeginLoopback).not.toHaveBeenCalled()
    expect(state.status).toBe('auth_required')
    expect(state.error).toBe('auth_required:inputs')
  })

  it('begins the oauth loopback in none mode', async () => {
    const state = await authenticate('github', noneConfig, { skipTrustCheck: true })

    expect(oauthBeginLoopback).toHaveBeenCalledWith(connectionKey(undefined, 'github'))
    expect(start).not.toHaveBeenCalled()
    expect(startHttp).toHaveBeenCalled()
    expect(state).toEqual(connected)
  })

  it('begins the oauth loopback in oauth mode', async () => {
    const state = await authenticate('github', oauthConfig, { skipTrustCheck: true })

    expect(oauthBeginLoopback).toHaveBeenCalledWith(connectionKey(undefined, 'github'))
    expect(startHttp).toHaveBeenCalled()
    expect(state).toEqual(connected)
  })

  it('runs oauth discovery against a resolved templated url', async () => {
    getEnvVars.mockResolvedValue({ HOST: 'mcp.example' })

    const templated: McpHttpServer = {
      type: 'http',
      url: 'https://${env:HOST}/mcp',
      auth: 'oauth',
    }

    await expect(
      authenticate('github', templated, { skipTrustCheck: true }),
    ).resolves.toEqual(connected)

    expect(auth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        serverUrl: 'https://mcp.example/mcp',
      }),
    )
    expect(startHttp).toHaveBeenCalledWith(
      'github',
      expect.objectContaining({
        url: 'https://mcp.example/mcp',
        auth: 'oauth',
      }),
      expect.objectContaining({ skipTrustCheck: true }),
      expect.anything(),
    )
  })
})
