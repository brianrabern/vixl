import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpHttpServer, McpStdioServer } from '@/types/vixl/mcp-config'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'

const { getSecret, setSecret, deleteSecret, getEnvVars } = vi.hoisted(() => ({
  getSecret: vi.fn<(key: string) => Promise<string | null>>(),
  setSecret: vi.fn<(key: string, value: string) => Promise<void>>(),
  deleteSecret: vi.fn<(key: string) => Promise<void>>(),
  getEnvVars: vi.fn<(names: string[]) => Promise<Record<string, string>>>(async () => ({})),
}))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    getSecret,
    setSecret,
    deleteSecret,
    getEnvVars,
  }),
)

import {
  listRequiredInputIdsForServer,
  loadMcpInputValues,
  resolveMcpTemplateEnv,
  resolveServerTemplates,
  saveMcpInputValues,
} from '@/services/mcp/resolve-mcp-inputs'

describe('resolve-mcp-inputs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists required input ids from stdio env and args', () => {
    const server: McpStdioServer = {
      command: 'npx',
      args: ['--token', '${input:cliToken}', 'run'],
      env: {
        API_KEY: '${input:apiKey}',
        PATH: '/usr/bin',
      },
    }

    expect(listRequiredInputIdsForServer(server).sort()).toEqual([
      'apiKey',
      'cliToken',
    ])
  })

  it('lists required input ids from http headers', () => {
    const server: McpHttpServer = {
      type: 'http',
      url: 'https://mcp.example.com',
      headers: {
        Authorization: 'Bearer ${input:token}',
        'X-Org': '${input:org}',
      },
    }

    expect(listRequiredInputIdsForServer(server).sort()).toEqual(['org', 'token'])
  })

  it('loads and saves input values via keychain', async () => {
    getSecret.mockImplementation(async (key) => {
      if (key === 'vixl:mcp:github:input:token') {
        return 'stored'
      }
      return null
    })
    setSecret.mockResolvedValue(undefined)

    const loaded = await loadMcpInputValues('github', ['token', 'missing'])
    expect(loaded).toEqual({
      values: { token: 'stored' },
      missing: ['missing'],
    })
    expect(getSecret).toHaveBeenCalledWith('vixl:mcp:github:input:token')
    expect(getSecret).toHaveBeenCalledWith('vixl:mcp:github:input:missing')

    await saveMcpInputValues('github', { token: 'next' })
    expect(setSecret).toHaveBeenCalledWith('vixl:mcp:github:input:token', 'next')
  })

  it('collects stdio env templates and fetches them via getEnvVars', async () => {
    getEnvVars.mockResolvedValue({
      HOME: '/tmp',
      PATH: '/usr/bin',
      TOKEN: 'secret',
    })

    const server: McpStdioServer = {
      command: '${env:HOME}/bin/npx',
      args: ['--token', '${env:TOKEN}', 'run'],
      env: {
        PATH: '${env:PATH}',
        TOKEN: '${env:TOKEN}',
      },
    }

    const resolved = await resolveMcpTemplateEnv(server)
    expect(getEnvVars).toHaveBeenCalledWith(['HOME', 'PATH', 'TOKEN'])
    expect(resolved).toEqual({
      HOME: '/tmp',
      PATH: '/usr/bin',
      TOKEN: 'secret',
    })
  })

  it('collects http url and header env templates and fetches them via getEnvVars', async () => {
    getEnvVars.mockResolvedValue({
      HOST: 'mcp.example',
      TOKEN: 'secret',
    })

    const server: McpHttpServer = {
      type: 'http',
      url: 'https://${env:HOST}/mcp',
      headers: {
        Authorization: 'Bearer ${env:TOKEN}',
        'X-Dup': '${env:TOKEN}',
      },
    }

    const resolved = await resolveMcpTemplateEnv(server)
    expect(getEnvVars).toHaveBeenCalledWith(['HOST', 'TOKEN'])
    expect(resolved).toEqual({
      HOST: 'mcp.example',
      TOKEN: 'secret',
    })
  })

  it('substitutes env templates in http url and headers', async () => {
    const resolved = await resolveServerTemplates(
      'docs',
      {
        type: 'http',
        url: 'https://${env:HOST}/mcp',
        headers: {
          Authorization: 'Bearer ${env:TOKEN}',
        },
      },
      { HOST: 'mcp.example', TOKEN: 'secret' },
    )

    expect(resolved.url).toBe('https://mcp.example/mcp')
    expect(resolved.headers).toEqual({ Authorization: 'Bearer secret' })
  })

  it('substitutes env templates in stdio command, args, and env', async () => {
    const resolved = await resolveServerTemplates(
      'cli',
      {
        command: '${env:BIN}',
        args: ['${env:PKG}'],
        env: { TOKEN: '${env:TOKEN}' },
      },
      { BIN: 'npx', PKG: 'server', TOKEN: 'secret' },
    )

    expect(resolved.command).toBe('npx')
    expect(resolved.args).toEqual(['server'])
    expect(resolved.serverEnv).toEqual({ TOKEN: 'secret' })
  })

  it('throws when an env template is missing', async () => {
    await expect(
      resolveServerTemplates(
        'docs',
        { type: 'http', url: 'https://${env:HOST}/mcp' },
        {},
      ),
    ).rejects.toThrow('Missing environment variable: HOST')
  })

  it('returns an empty object without calling getEnvVars when no env templates exist', async () => {
    const resolved = await resolveMcpTemplateEnv({
      type: 'http',
      url: 'https://mcp.example.com',
      headers: {
        Authorization: 'Bearer ${input:token}',
      },
    })

    expect(resolved).toEqual({})
    expect(getEnvVars).not.toHaveBeenCalled()
  })
})
