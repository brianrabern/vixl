import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpStdioServer } from '@/types/vixl/mcp-config'
import { mockVixlTauri } from '../../../test-utils/mocks/vixl-tauri'

const deleteSecret = vi.hoisted(() =>
  vi.fn<(key: string) => Promise<void>>(async () => undefined),
)

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    deleteSecret,
  }),
)

import { mcpKnownSecretKeys } from '@/services/mcp/mcp-keychain-keys'
import {
  assertServerTrusted,
  clearServerSecrets,
} from '@/services/mcp/mcp-runtime/trust'

const stdioConfig: McpStdioServer = {
  command: 'npx',
  args: ['server'],
  env: {
    API_KEY: '${input:apiKey}',
  },
}

const oauthConfig = {
  type: 'http' as const,
  url: 'https://mcp.example/mcp',
  auth: 'oauth' as const,
  headers: {
    Authorization: 'Bearer ${input:token}',
  },
}

describe('mcp-runtime trust', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears oauth secrets without wiping input secrets', async () => {
    await clearServerSecrets('demo', oauthConfig)
    const keys = deleteSecret.mock.calls.map((call) => call[0])
    expect(keys).toEqual(mcpKnownSecretKeys('demo'))
    expect(keys.some((key) => String(key).includes(':input:'))).toBe(false)
  })

  it('does not clear secrets for header auth servers', async () => {
    await clearServerSecrets('demo', {
      type: 'http',
      url: 'https://mcp.example/mcp',
      auth: 'headers',
      headers: {
        Authorization: 'Bearer ${input:token}',
      },
    })
    expect(deleteSecret).not.toHaveBeenCalled()
  })

  it('does not clear secrets for none auth servers', async () => {
    await clearServerSecrets('demo', {
      type: 'http',
      url: 'https://mcp.example/mcp',
      auth: 'none',
    })
    expect(deleteSecret).not.toHaveBeenCalled()
  })

  it('skips trust when skipTrustCheck is set', () => {
    expect(() =>
      assertServerTrusted('demo', stdioConfig, { skipTrustCheck: true }),
    ).not.toThrow()
  })

  it('requires settings when trust must be checked', () => {
    expect(() => assertServerTrusted('demo', stdioConfig)).toThrow(
      /requires settings/,
    )
  })

  it('rejects untrusted servers', () => {
    expect(() =>
      assertServerTrusted('demo', stdioConfig, {
        settings: {
          version: 1,
          appearance: { theme: 'system' },
          providers: {},
          permissions: {
            dial: 'ask',
            autoApprove: {
              read: false,
              write: false,
              shell: false,
              network: false,
              mcp: false,
            },
          },
          mcp: { trusted: {} },
        } as never,
      }),
    ).toThrow(/not trusted/)
  })
})
