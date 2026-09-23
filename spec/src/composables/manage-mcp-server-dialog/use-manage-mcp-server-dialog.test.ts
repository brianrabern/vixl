import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import ALLOWED_MCP_COMMANDS from '@/services/mcp/allowed-mcp-commands'
import useManageMcpServerDialog from '@/composables/manage-mcp-server-dialog'
import { getSecret } from '@/services/vixl/vixl-tauri'
import type { McpConfig, McpHttpServer, McpStdioServer } from '@/types/vixl/mcp-config'

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/services/vixl/vixl-tauri', () => mockVixlTauri())

const emptyConfig: McpConfig = { servers: {} }

const createDialog = () => {
  const emit = vi.fn<(...args: unknown[]) => void>()
  const dialog = useManageMcpServerDialog(
    {
      open: false,
      mode: 'create',
      mcpConfig: emptyConfig,
    },
    emit,
  )
  dialog.draftId.value = 'docker-mcp'
  dialog.transport.value = 'stdio'
  return { dialog, emit }
}

describe('use-manage-mcp-server-dialog stdio command allowlist', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
  })

  it('saves a stdio server when command is docker', () => {
    const { dialog, emit } = createDialog()
    dialog.command.value = 'docker'
    dialog.argsText.value = 'run, -i, --rm, mcp/docker-server'

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        serverId: 'docker-mcp',
        config: expect.objectContaining({
          command: 'docker',
          args: ['run', '-i', '--rm', 'mcp/docker-server'],
        } satisfies Partial<McpStdioServer>),
      }),
    )
    expect(emit).toHaveBeenCalledWith('update:open', false)
  })

  it('rejects bash with a toast that lists allowed commands', () => {
    const { dialog, emit } = createDialog()
    dialog.command.value = 'bash'

    dialog.handleSave()

    expect(emit).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      `MCP command 'bash' is not allowed. Use one of: ${ALLOWED_MCP_COMMANDS.join(', ')}`,
    )
  })

  it('rejects an absolute command path', () => {
    const { dialog, emit } = createDialog()
    dialog.command.value = '/usr/bin/docker'

    dialog.handleSave()

    expect(emit).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'MCP command must be a PATH basename (for example npx or uvx), not a filesystem path',
    )
  })
})

describe('use-manage-mcp-server-dialog http auth', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(getSecret).mockResolvedValue(null)
  })

  const createHttpDialog = () => {
    const emit = vi.fn<(...args: unknown[]) => void>()
    const dialog = useManageMcpServerDialog(
      {
        open: false,
        mode: 'create',
        mcpConfig: emptyConfig,
      },
      emit,
    )
    dialog.draftId.value = 'remote-mcp'
    dialog.transport.value = 'http'
    dialog.url.value = 'https://example.com/mcp'
    return { dialog, emit }
  }

  it('defaults auth type to none when creating', () => {
    const { dialog } = createHttpDialog()
    expect(dialog.authMode.value).toBe('none')
  })

  it('saves auth none without an oauth block', () => {
    const { dialog, emit } = createHttpDialog()
    dialog.authMode.value = 'none'
    dialog.oauthClientId.value = 'should-not-save'

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        serverId: 'remote-mcp',
        config: {
          type: 'http',
          url: 'https://example.com/mcp',
          auth: 'none',
        },
      }),
    )
  })

  it('requires at least one header when auth is headers', () => {
    const { dialog, emit } = createHttpDialog()
    dialog.authMode.value = 'headers'

    dialog.handleSave()

    expect(emit).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('At least one header is required')
  })

  it('saves auth headers with header secret templates', () => {
    const { dialog, emit } = createHttpDialog()
    dialog.authMode.value = 'headers'
    dialog.headerRows.value = [
      { key: 'Authorization', value: 'Bearer secret', configured: false },
    ]

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        config: expect.objectContaining({
          type: 'http',
          auth: 'headers',
          headers: { Authorization: '${input:Authorization}' },
        }),
        secretValues: { Authorization: 'Bearer secret' },
      }),
    )
    const payload = emit.mock.calls.find((call) => call[0] === 'save')?.[1] as {
      config: { oauth?: unknown }
    }
    expect(payload.config.oauth).toBeUndefined()
  })

  it('saves oauth fields and client secret as an input template', () => {
    const { dialog, emit } = createHttpDialog()
    dialog.authMode.value = 'oauth'
    dialog.oauthClientId.value = 'client-id'
    dialog.oauthClientSecret.value = 'client-secret'
    dialog.oauthScopesText.value = 'openid, profile'
    dialog.oauthCallbackPort.value = '8080'
    dialog.oauthAuthServerMetadataUrl.value =
      'https://auth.example.com/.well-known/oauth-authorization-server'
    dialog.asAllowlistText.value = 'https://auth.example.com'

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        config: expect.objectContaining({
          type: 'http',
          auth: 'oauth',
          oauth: {
            clientId: 'client-id',
            allowedAuthorizationServers: ['https://auth.example.com'],
            scopes: ['openid', 'profile'],
            callbackPort: 8080,
            authServerMetadataUrl:
              'https://auth.example.com/.well-known/oauth-authorization-server',
            clientSecret: '${input:oauth_client_secret}',
          },
        }),
        secretValues: { oauth_client_secret: 'client-secret' },
      }),
    )
  })

  it('clears header rows when the user switches from headers to oauth', () => {
    const { dialog, emit } = createHttpDialog()
    dialog.authMode.value = 'headers'
    dialog.headerRows.value = [
      { key: 'Authorization', value: 'Bearer secret', configured: false },
    ]

    dialog.authMode.value = 'oauth'
    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    const payload = emit.mock.calls.find((call) => call[0] === 'save')?.[1] as {
      config: { auth: string; headers?: unknown }
    }
    expect(payload.config.auth).toBe('oauth')
    expect(payload.config.headers).toBeUndefined()
  })

  it('preserves headers when editing oauth without changing auth type', async () => {
    const emit = vi.fn<(...args: unknown[]) => void>()
    vi.mocked(getSecret).mockResolvedValue('stored')
    const props = reactive({
      open: false,
      mode: 'edit' as const,
      serverId: 'remote-mcp',
      initialConfig: {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: 'oauth',
        headers: { Authorization: '${input:Authorization}' },
        oauth: { clientId: 'client-id' },
      } satisfies McpHttpServer,
      mcpConfig: emptyConfig,
    })
    const dialog = useManageMcpServerDialog(props, emit)
    props.open = true
    await nextTick()
    await vi.waitFor(() => {
      expect(dialog.authMode.value).toBe('oauth')
      expect(dialog.headerRows.value).toEqual([
        expect.objectContaining({ key: 'Authorization', configured: true }),
      ])
    })

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        config: expect.objectContaining({
          type: 'http',
          auth: 'oauth',
          headers: { Authorization: '${input:Authorization}' },
          oauth: { clientId: 'client-id' },
        }),
      }),
    )
  })

  it('omits an empty oauth object when auth is oauth and fields are blank', () => {
    const { dialog, emit } = createHttpDialog()
    dialog.authMode.value = 'oauth'

    dialog.handleSave()

    expect(toast.error).not.toHaveBeenCalled()
    const payload = emit.mock.calls.find((call) => call[0] === 'save')?.[1] as {
      config: { auth: string; oauth?: unknown }
    }
    expect(payload.config.auth).toBe('oauth')
    expect(payload.config.oauth).toBeUndefined()
  })
})
