import { describe, expect, it } from 'vitest'
import { defaultMcpConfig, migrateMcpConfig, parseMcpConfig } from '@/schemas/mcp-config'
import {
  canOfferMcpOAuthLogin,
  canShowMcpOAuthLoginControl,
  getMcpAuthMode,
  isMcpAuthRequiredInputsError,
  isMcpHttpServer,
  isMcpStdioServer,
} from '@/types/vixl/mcp-config'

describe('migrateMcpConfig', () => {
  it('returns default for non-objects', () => {
    expect(migrateMcpConfig(null)).toEqual(defaultMcpConfig())
    expect(migrateMcpConfig('nope')).toEqual(defaultMcpConfig())
  })

  it('migrates servers with inputs and oauth', () => {
    const migrated = migrateMcpConfig({
      servers: {
        local: {
          command: 'npx',
          args: ['-y', 'server'],
          env: { TOKEN: '${input:token}' },
        },
        remote: {
          type: 'http',
          url: 'https://mcp.example.com/sse',
          headers: { Authorization: 'Bearer ${input:token}' },
          oauth: {
            clientId: 'client-1',
            allowedAuthorizationServers: ['https://auth.example.com'],
          },
        },
      },
      inputs: [
        {
          id: 'token',
          type: 'promptString',
          description: 'API token',
          password: true,
        },
      ],
    })

    expect(Object.keys(migrated.servers)).toEqual(['local', 'remote'])
    expect(isMcpStdioServer(migrated.servers.local!)).toBe(true)
    const remote = migrated.servers.remote!
    expect(isMcpHttpServer(remote)).toBe(true)
    if (!isMcpHttpServer(remote)) {
      throw new Error('expected remote to be an HTTP MCP server')
    }
    expect(remote.oauth?.clientId).toBe('client-1')
    expect(migrated.inputs).toEqual([
      {
        id: 'token',
        type: 'promptString',
        description: 'API token',
        password: true,
      },
    ])
  })

  it('recovers valid servers when oauth or inputs are malformed', () => {
    const migrated = migrateMcpConfig({
      servers: {
        good: {
          type: 'sse',
          url: 'https://mcp.example.com/sse',
        },
        badOauth: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          oauth: { clientId: 123 },
        },
        badStdio: {
          command: '',
        },
        stdio: {
          command: 'uvx',
          args: ['mcp-server'],
        },
      },
      inputs: [{ id: 'x' }, 'not-an-input'],
    })

    expect(Object.keys(migrated.servers).sort()).toEqual(['good', 'stdio'])
    expect(migrated.inputs).toBeUndefined()
  })

  it('keeps stdio and http shapes distinct', () => {
    const migrated = migrateMcpConfig({
      servers: {
        stdio: { command: 'node', args: ['server.js'] },
        http: { type: 'http', url: 'https://example.com/mcp' },
      },
    })

    expect(isMcpStdioServer(migrated.servers.stdio!)).toBe(true)
    expect(isMcpHttpServer(migrated.servers.stdio!)).toBe(false)
    expect(isMcpHttpServer(migrated.servers.http!)).toBe(true)
    expect(isMcpStdioServer(migrated.servers.http!)).toBe(false)
  })
})

describe('parseMcpConfig', () => {
  it('treats missing and empty objects as a valid empty config', () => {
    expect(parseMcpConfig(null)).toEqual({ ok: true, config: defaultMcpConfig() })
    expect(parseMcpConfig({})).toEqual({ ok: true, config: defaultMcpConfig() })
    expect(parseMcpConfig({ servers: {} })).toEqual({
      ok: true,
      config: { servers: {} },
    })
  })

  it('fails when the payload has content but no recoverable servers', () => {
    expect(parseMcpConfig('nope').ok).toBe(false)
    expect(parseMcpConfig({ mcpServers: { local: { command: 'npx' } } }).ok).toBe(false)
    expect(
      parseMcpConfig({
        servers: {
          bad: { command: '' },
        },
      }).ok,
    ).toBe(false)
  })

  it('accepts each http auth mode', () => {
    const parsed = parseMcpConfig({
      servers: {
        none: { type: 'http', url: 'https://mcp.example.com/http', auth: 'none' },
        headers: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          auth: 'headers',
          headers: { Authorization: 'Bearer ${input:token}' },
        },
        oauth: {
          type: 'sse',
          url: 'https://mcp.example.com/sse',
          auth: 'oauth',
          oauth: { clientId: 'client-1' },
        },
      },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      throw new Error('expected auth modes to parse')
    }
    const none = parsed.config.servers.none!
    const headers = parsed.config.servers.headers!
    const oauth = parsed.config.servers.oauth!
    expect(isMcpHttpServer(none) && none.auth).toBe('none')
    expect(isMcpHttpServer(headers) && headers.auth).toBe('headers')
    expect(isMcpHttpServer(oauth) && oauth.auth).toBe('oauth')
  })

  it('accepts extended oauth pre-registration fields', () => {
    const parsed = parseMcpConfig({
      servers: {
        remote: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          auth: 'oauth',
          oauth: {
            clientId: 'client-1',
            clientSecret: '${input:oauth_secret}',
            scopes: ['mcp:read', 'mcp:write'],
            callbackPort: 8080,
            authServerMetadataUrl:
              'https://auth.example.com/.well-known/oauth-authorization-server',
            allowedAuthorizationServers: ['https://auth.example.com'],
          },
        },
      },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      throw new Error('expected oauth fields to parse')
    }
    const remote = parsed.config.servers.remote!
    expect(isMcpHttpServer(remote)).toBe(true)
    if (!isMcpHttpServer(remote)) {
      throw new Error('expected remote to be an HTTP MCP server')
    }
    expect(remote.oauth).toEqual({
      clientId: 'client-1',
      clientSecret: '${input:oauth_secret}',
      scopes: ['mcp:read', 'mcp:write'],
      callbackPort: 8080,
      authServerMetadataUrl: 'https://auth.example.com/.well-known/oauth-authorization-server',
      allowedAuthorizationServers: ['https://auth.example.com'],
    })
  })

  it('accepts http urls that contain env or input templates', () => {
    const parsed = parseMcpConfig({
      servers: {
        envHost: { type: 'http', url: 'https://${env:HOST}/mcp' },
        inputHost: { type: 'sse', url: 'https://${input:host}/mcp' },
      },
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      throw new Error('expected templated urls to parse')
    }
    const envHost = parsed.config.servers.envHost!
    const inputHost = parsed.config.servers.inputHost!
    expect(isMcpHttpServer(envHost) && envHost.url).toBe('https://${env:HOST}/mcp')
    expect(isMcpHttpServer(inputHost) && inputHost.url).toBe('https://${input:host}/mcp')
  })

  it('drops templated urls that are invalid after placeholder substitution', () => {
    const parsed = parseMcpConfig({
      servers: {
        good: { type: 'http', url: 'https://mcp.example.com/http' },
        bad: { type: 'http', url: 'not-a-url/${env:HOST}' },
      },
    })

    expect(parsed).toEqual({
      ok: true,
      config: {
        servers: {
          good: { type: 'http', url: 'https://mcp.example.com/http' },
        },
      },
    })
  })

  it('drops plain invalid http urls', () => {
    const parsed = parseMcpConfig({
      servers: {
        good: { type: 'http', url: 'https://mcp.example.com/http' },
        bad: { type: 'http', url: 'not-a-url' },
      },
    })

    expect(parsed).toEqual({
      ok: true,
      config: {
        servers: {
          good: { type: 'http', url: 'https://mcp.example.com/http' },
        },
      },
    })
  })

  it('drops servers with a plaintext oauth clientSecret', () => {
    const parsed = parseMcpConfig({
      servers: {
        good: { type: 'http', url: 'https://mcp.example.com/http' },
        plaintext: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          oauth: { clientSecret: 'super-secret' },
        },
      },
    })

    expect(parsed).toEqual({
      ok: true,
      config: {
        servers: {
          good: { type: 'http', url: 'https://mcp.example.com/http' },
        },
      },
    })
  })

  it('drops auth none combined with an oauth block', () => {
    const parsed = parseMcpConfig({
      servers: {
        good: { type: 'http', url: 'https://mcp.example.com/http' },
        bad: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          auth: 'none',
          oauth: { clientId: 'client-1' },
        },
      },
    })

    expect(parsed).toEqual({
      ok: true,
      config: {
        servers: {
          good: { type: 'http', url: 'https://mcp.example.com/http' },
        },
      },
    })
  })

  it('drops auth headers when headers are missing or empty', () => {
    const parsed = parseMcpConfig({
      servers: {
        good: { type: 'http', url: 'https://mcp.example.com/http' },
        missing: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          auth: 'headers',
        },
        empty: {
          type: 'sse',
          url: 'https://mcp.example.com/sse',
          auth: 'headers',
          headers: {},
        },
      },
    })

    expect(parsed).toEqual({
      ok: true,
      config: {
        servers: {
          good: { type: 'http', url: 'https://mcp.example.com/http' },
        },
      },
    })
  })

  it('drops servers with a bad oauth callbackPort or authServerMetadataUrl', () => {
    const parsed = parseMcpConfig({
      servers: {
        good: { type: 'http', url: 'https://mcp.example.com/http' },
        zeroPort: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          oauth: { callbackPort: 0 },
        },
        negativePort: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          oauth: { callbackPort: -1 },
        },
        floatPort: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          oauth: { callbackPort: 1.5 },
        },
        badMetadata: {
          type: 'http',
          url: 'https://mcp.example.com/http',
          oauth: { authServerMetadataUrl: 'not-a-url' },
        },
      },
    })

    expect(parsed).toEqual({
      ok: true,
      config: {
        servers: {
          good: { type: 'http', url: 'https://mcp.example.com/http' },
        },
      },
    })
  })
})

describe('getMcpAuthMode', () => {
  it('returns none for stdio servers', () => {
    expect(getMcpAuthMode({ command: 'npx' })).toBe('none')
  })

  it('returns the explicit auth value when set', () => {
    expect(
      getMcpAuthMode({
        type: 'http',
        url: 'https://mcp.example.com/http',
        auth: 'none',
        headers: { Authorization: 'Bearer x' },
      }),
    ).toBe('none')
    expect(
      getMcpAuthMode({
        type: 'http',
        url: 'https://mcp.example.com/http',
        auth: 'headers',
        headers: { Authorization: 'Bearer x' },
      }),
    ).toBe('headers')
    expect(
      getMcpAuthMode({
        type: 'sse',
        url: 'https://mcp.example.com/sse',
        auth: 'oauth',
      }),
    ).toBe('oauth')
  })

  it('infers oauth when an oauth block is present', () => {
    expect(
      getMcpAuthMode({
        type: 'http',
        url: 'https://mcp.example.com/http',
        oauth: { clientId: 'client-1' },
      }),
    ).toBe('oauth')
  })

  it('infers headers when headers are present and non-empty', () => {
    expect(
      getMcpAuthMode({
        type: 'http',
        url: 'https://mcp.example.com/http',
        headers: { Authorization: 'Bearer x' },
      }),
    ).toBe('headers')
  })

  it('infers oauth when http has neither oauth nor headers', () => {
    expect(
      getMcpAuthMode({
        type: 'http',
        url: 'https://mcp.example.com/http',
      }),
    ).toBe('oauth')
  })
})

describe('canOfferMcpOAuthLogin', () => {
  it('is true for oauth and explicit none http servers', () => {
    expect(
      canOfferMcpOAuthLogin({
        type: 'http',
        url: 'https://mcp.example.com/http',
        auth: 'oauth',
      }),
    ).toBe(true)
    expect(
      canOfferMcpOAuthLogin({
        type: 'http',
        url: 'https://mcp.example.com/http',
        auth: 'none',
      }),
    ).toBe(true)
  })

  it('is false for headers http and stdio servers', () => {
    expect(
      canOfferMcpOAuthLogin({
        type: 'http',
        url: 'https://mcp.example.com/http',
        auth: 'headers',
        headers: { Authorization: 'Bearer x' },
      }),
    ).toBe(false)
    expect(canOfferMcpOAuthLogin({ command: 'npx' })).toBe(false)
  })
})

describe('canShowMcpOAuthLoginControl', () => {
  const noneHttp = {
    type: 'http' as const,
    url: 'https://mcp.example.com/http',
    auth: 'none' as const,
  }

  it('is true for none-mode auth_required without the inputs marker', () => {
    expect(canShowMcpOAuthLoginControl(noneHttp, 'auth_required', 'unauthorized')).toBe(
      true,
    )
    expect(canShowMcpOAuthLoginControl(noneHttp, 'auth_required', null)).toBe(true)
  })

  it('is false when the error is the inputs marker', () => {
    expect(
      canShowMcpOAuthLoginControl(noneHttp, 'auth_required', 'auth_required:inputs'),
    ).toBe(false)
    expect(isMcpAuthRequiredInputsError('auth_required:inputs')).toBe(true)
  })

  it('is false when status is not auth_required', () => {
    expect(canShowMcpOAuthLoginControl(noneHttp, 'connected', null)).toBe(false)
    expect(canShowMcpOAuthLoginControl(noneHttp, 'stopped', null)).toBe(false)
  })
})
