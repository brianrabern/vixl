import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import {
  buildHttpServerConfig,
  type HttpFormState,
} from '@/composables/manage-mcp-server-dialog/build-http-config'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/services/vixl/vixl-tauri', () => mockVixlTauri())

const baseForm = (overrides: Partial<HttpFormState> = {}): HttpFormState => ({
  transport: 'http',
  url: 'https://example.com/mcp',
  authMode: 'none',
  headerRows: [],
  oauthClientId: '',
  asAllowlistText: '',
  oauthClientSecret: '',
  oauthClientSecretInputId: '',
  oauthClientSecretTemplate: '',
  oauthScopesText: '',
  oauthCallbackPort: '',
  oauthAuthServerMetadataUrl: '',
  ...overrides,
})

describe('buildHttpServerConfig', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
  })

  it('rejects a plain invalid url', () => {
    const result = buildHttpServerConfig(baseForm({ url: 'not-a-url' }))

    expect(result).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith('Invalid MCP server URL: not-a-url')
  })

  it('rejects a templated url that is invalid after placeholder substitution', () => {
    const result = buildHttpServerConfig(baseForm({ url: 'not-a-url/${env:HOST}' }))

    expect(result).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith('Invalid MCP server URL: not-a-url/${env:HOST}')
  })

  it('accepts a url that is valid after placeholder substitution', () => {
    const result = buildHttpServerConfig(
      baseForm({
        url: 'https://${env:HOST}/mcp',
        authMode: 'none',
      }),
    )

    expect(toast.error).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      config: {
        type: 'http',
        url: 'https://${env:HOST}/mcp',
        auth: 'none',
      },
      inputs: [],
      secretValues: {},
    })
  })

  it('requires at least one header row in headers mode', () => {
    const result = buildHttpServerConfig(baseForm({ authMode: 'headers' }))

    expect(result).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith('At least one header is required')
  })

  it('never emits an oauth block in none mode', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'none',
        oauthClientId: 'should-not-save',
        oauthClientSecret: 'secret',
        oauthScopesText: 'openid',
        oauthCallbackPort: '8080',
        oauthAuthServerMetadataUrl:
          'https://auth.example.com/.well-known/oauth-authorization-server',
      }),
    )

    expect(result).toEqual({
      ok: true,
      config: {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: 'none',
      },
      inputs: [],
      secretValues: {},
    })
  })

  it('writes oauth fields and clientSecret as an input template', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'oauth',
        oauthScopesText: 'openid, profile',
        oauthCallbackPort: '8080',
        oauthAuthServerMetadataUrl:
          'https://auth.example.com/.well-known/oauth-authorization-server',
        oauthClientSecret: 'client-secret',
      }),
    )

    expect(toast.error).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      config: {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: 'oauth',
        oauth: {
          scopes: ['openid', 'profile'],
          callbackPort: 8080,
          authServerMetadataUrl:
            'https://auth.example.com/.well-known/oauth-authorization-server',
          clientSecret: '${input:oauth_client_secret}',
        },
      },
      inputs: [
        {
          id: 'oauth_client_secret',
          type: 'promptString',
          description: 'oauth_client_secret',
          password: true,
        },
      ],
      secretValues: {
        oauth_client_secret: 'client-secret',
      },
    })
  })

  it('fails when the callback port is not a positive integer', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'oauth',
        oauthCallbackPort: 'abc',
      }),
    )

    expect(result).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith('Callback port must be a positive integer')
  })

  it('fails when an allowlist entry is not a URL', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'oauth',
        asAllowlistText: 'https://auth.example.com\nauth.example.com',
      }),
    )

    expect(result).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith(
      'Invalid authorization server URL: auth.example.com',
    )
  })

  it('fails when the metadata URL is not a URL', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'oauth',
        oauthAuthServerMetadataUrl: 'auth.example.com/.well-known/oauth-authorization-server',
      }),
    )

    expect(result).toEqual({ ok: false })
    expect(toast.error).toHaveBeenCalledWith(
      'Invalid authorization server metadata URL: auth.example.com/.well-known/oauth-authorization-server',
    )
  })

  it('preserves header rows in oauth mode and merges inputs', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'oauth',
        headerRows: [
          { key: 'Authorization', value: 'Bearer secret', configured: false },
        ],
        oauthClientSecret: 'client-secret',
      }),
    )

    expect(toast.error).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      config: {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: 'oauth',
        headers: { Authorization: '${input:Authorization}' },
        oauth: {
          clientSecret: '${input:oauth_client_secret}',
        },
      },
      inputs: [
        {
          id: 'Authorization',
          type: 'promptString',
          description: 'Authorization',
          password: true,
        },
        {
          id: 'oauth_client_secret',
          type: 'promptString',
          description: 'oauth_client_secret',
          password: true,
        },
      ],
      secretValues: {
        Authorization: 'Bearer secret',
        oauth_client_secret: 'client-secret',
      },
    })
  })

  it('omits the headers key in oauth mode when there are no header rows', () => {
    const result = buildHttpServerConfig(baseForm({ authMode: 'oauth' }))

    expect(toast.error).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      config: {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: 'oauth',
      },
      inputs: [],
      secretValues: {},
    })
    expect(result.ok && 'headers' in result.config).toBe(false)
  })

  it('writes valid allowlist and metadata URLs', () => {
    const result = buildHttpServerConfig(
      baseForm({
        authMode: 'oauth',
        asAllowlistText: 'https://auth.example.com\nhttps://login.example.com',
        oauthAuthServerMetadataUrl:
          'https://auth.example.com/.well-known/oauth-authorization-server',
      }),
    )

    expect(toast.error).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      config: {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: 'oauth',
        oauth: {
          allowedAuthorizationServers: [
            'https://auth.example.com',
            'https://login.example.com',
          ],
          authServerMetadataUrl:
            'https://auth.example.com/.well-known/oauth-authorization-server',
        },
      },
      inputs: [],
      secretValues: {},
    })
  })
})
