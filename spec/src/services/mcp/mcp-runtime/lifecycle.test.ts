import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpHttpServer } from '@/types/vixl/mcp-config'
import type { McpServerState } from '@/services/vixl/vixl-tauri'
import { mockVixlTauri } from '../../../test-utils/mocks/vixl-tauri'

const {
  startHttpServer,
  markHttpAuthRequired,
  createTokenProvider,
  tokenProvider,
  getEnvVars,
} = vi.hoisted(() => {
  const tokenProvider = { kind: 'oauth-provider' }
  return {
    tokenProvider,
    getEnvVars: vi.fn<(names: string[]) => Promise<Record<string, string>>>(
      async () => ({}),
    ),
    startHttpServer: vi.fn<
      (
        serverId: string,
        config: McpHttpServer,
        options?: { authProvider?: unknown; scopeKey?: string | null },
      ) => Promise<McpServerState>
    >(),
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
    createTokenProvider: vi.fn<(...args: unknown[]) => unknown>(
      () => tokenProvider,
    ),
  }
})

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    getEnvVars,
  }),
)

vi.mock('@/services/mcp/mcp-http-client', () => ({
  hasHttpServer: vi.fn<(...args: unknown[]) => boolean>(() => false),
  logoutHttpServer: vi.fn<(...args: unknown[]) => unknown>(),
  markHttpAuthRequired: (
    serverId: string,
    config: McpHttpServer,
    error?: string | null,
    scopeKey?: string | null,
  ) => markHttpAuthRequired(serverId, config, error, scopeKey),
  refreshHttpServer: vi.fn<(...args: unknown[]) => unknown>(),
  startHttpServer: (
    serverId: string,
    config: McpHttpServer,
    options?: { authProvider?: unknown; scopeKey?: string | null },
  ) => startHttpServer(serverId, config, options),
  stopHttpServer: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock('@/services/mcp/mcp-runtime/oauth', () => ({
  createTokenProvider: (...args: unknown[]) => createTokenProvider(...args),
}))

import { startHttp } from '@/services/mcp/mcp-runtime/lifecycle'

const connected: McpServerState = {
  serverId: 'demo',
  status: 'connected',
  tools: [],
}

const oauthConfig: McpHttpServer = {
  type: 'http',
  url: 'https://mcp.example/mcp',
  auth: 'oauth',
}

const headersConfig: McpHttpServer = {
  type: 'http',
  url: 'https://mcp.example/mcp',
  auth: 'headers',
  headers: {
    Authorization: 'Bearer token',
  },
}

const noneConfig: McpHttpServer = {
  type: 'http',
  url: 'https://mcp.example/mcp',
  auth: 'none',
}

const startOptions = { skipTrustCheck: true }

const authProviderFromCall = (): unknown => {
  const options = startHttpServer.mock.calls[0]?.[2]
  return options?.authProvider
}

describe('startHttp auth modes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEnvVars.mockResolvedValue({})
    createTokenProvider.mockReturnValue(tokenProvider)
    startHttpServer.mockResolvedValue(connected)
    markHttpAuthRequired.mockImplementation((serverId, _config, error) => ({
      serverId,
      status: 'auth_required',
      tools: [],
      error: error ?? null,
    }))
  })

  it('attaches an authProvider in oauth mode', async () => {
    await expect(startHttp('demo', oauthConfig, startOptions)).resolves.toEqual(
      connected,
    )

    expect(createTokenProvider).toHaveBeenCalled()
    expect(startHttpServer).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        type: 'http',
        url: oauthConfig.url,
        auth: 'oauth',
      }),
      expect.objectContaining({ authProvider: tokenProvider }),
    )
  })

  it('starts headers mode without an authProvider', async () => {
    await expect(startHttp('demo', headersConfig, startOptions)).resolves.toEqual(
      connected,
    )

    expect(createTokenProvider).not.toHaveBeenCalled()
    expect(authProviderFromCall()).toBeUndefined()
  })

  it('attaches an authProvider in none mode', async () => {
    await expect(startHttp('demo', noneConfig, startOptions)).resolves.toEqual(
      connected,
    )

    expect(createTokenProvider).toHaveBeenCalled()
    expect(startHttpServer).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        type: 'http',
        url: noneConfig.url,
        auth: 'none',
      }),
      expect.objectContaining({ authProvider: tokenProvider }),
    )
  })

  it('uses stored tokens on none-mode restart after oauth upgrade', async () => {
    const storedTokens = { access_token: 'upgraded-token' }
    const upgradedProvider = {
      tokens: vi.fn<() => Promise<{ access_token: string }>>(
        async () => storedTokens,
      ),
    }
    createTokenProvider.mockReturnValue(upgradedProvider)

    await expect(startHttp('demo', noneConfig, startOptions)).resolves.toEqual(
      connected,
    )

    expect(createTokenProvider).toHaveBeenCalled()
    expect(authProviderFromCall()).toBe(upgradedProvider)
    expect(startHttpServer).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        type: 'http',
        url: noneConfig.url,
        auth: 'none',
      }),
      expect.objectContaining({ authProvider: upgradedProvider }),
    )
  })

  it('maps headers-mode 401 to auth_required:inputs', async () => {
    startHttpServer.mockRejectedValueOnce(new Error('401'))

    const state = await startHttp('demo', headersConfig, startOptions)

    expect(state.status).toBe('auth_required')
    expect(state.error).toBe('auth_required:inputs')
    expect(markHttpAuthRequired).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ auth: 'headers' }),
      'auth_required:inputs',
      undefined,
    )
  })

  it('rewrites a returned headers-mode auth_required state to inputs', async () => {
    startHttpServer.mockResolvedValueOnce({
      serverId: 'demo',
      status: 'auth_required',
      tools: [],
      error: 'Unauthorized',
    })

    const state = await startHttp('demo', headersConfig, startOptions)

    expect(state.status).toBe('auth_required')
    expect(state.error).toBe('auth_required:inputs')
    expect(markHttpAuthRequired).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ auth: 'headers' }),
      'auth_required:inputs',
      undefined,
    )
  })

  it('connects an env-templated url to the resolved host', async () => {
    getEnvVars.mockResolvedValue({ HOST: 'mcp.example' })

    await expect(
      startHttp(
        'demo',
        {
          type: 'http',
          url: 'https://${env:HOST}/mcp',
          auth: 'none',
        },
        startOptions,
      ),
    ).resolves.toEqual(connected)

    expect(startHttpServer).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        url: 'https://mcp.example/mcp',
        auth: 'none',
      }),
      expect.anything(),
    )
  })

  it('rejects a resolved url that is not allowed', async () => {
    getEnvVars.mockResolvedValue({ HOST: 'evil.example' })

    await expect(
      startHttp(
        'demo',
        {
          type: 'http',
          url: 'http://${env:HOST}/mcp',
          auth: 'none',
        },
        startOptions,
      ),
    ).rejects.toThrow('MCP URL must use https, or http on localhost / 127.0.0.1')

    expect(startHttpServer).not.toHaveBeenCalled()
  })

  it('keeps auth_required for none-mode 401', async () => {
    startHttpServer.mockRejectedValueOnce(new Error('unauthorized'))

    const state = await startHttp('demo', noneConfig, startOptions)

    expect(state.status).toBe('auth_required')
    expect(state.error).toBe('unauthorized')
    expect(markHttpAuthRequired).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ auth: 'none' }),
      'unauthorized',
      undefined,
    )
  })
})
