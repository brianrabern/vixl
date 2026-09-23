import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  McpConfig,
  McpInputDefinition,
  McpServerConfig,
  McpStdioServer,
} from '@/types/vixl/mcp-config'
import {
  getMcpAuthMode,
  isMcpHttpServer,
  isMcpStdioServer,
} from '@/types/vixl/mcp-config'
import validateMcpStdioCommand from '@/services/mcp/validate-mcp-stdio-command'
import { buildHttpServerConfig, type HttpAuthMode } from './build-http-config'
import {
  buildSecretRecord,
  inputIdFromValue,
  missingSecretRowKey,
  OAUTH_CLIENT_SECRET_ID,
  probeConfigured,
  recordToSecretRows,
  type SecretRow,
} from './secret-rows'

type Transport = 'stdio' | 'http' | 'sse'

export type ManageMcpServerDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  serverId?: string | null
  initialConfig?: McpServerConfig | null
  mcpConfig: McpConfig
}

export type ManageMcpServerDialogEmit = {
  (event: 'update:open', open: boolean): void
  (
    event: 'save',
    payload: {
      serverId: string
      previousId?: string
      config: McpServerConfig
      inputs: McpInputDefinition[]
      secretValues: Record<string, string>
    },
  ): void
}

export default (props: ManageMcpServerDialogProps, emit: ManageMcpServerDialogEmit) => {
  const draftId = ref('')
  const transport = ref<Transport>('stdio')
  const command = ref('npx')
  const argsText = ref('')
  const url = ref('')
  const envRows = ref<SecretRow[]>([])
  const headerRows = ref<SecretRow[]>([])
  const authMode = ref<HttpAuthMode>('none')
  const oauthClientId = ref('')
  const asAllowlistText = ref('')
  const oauthClientSecret = ref('')
  const oauthClientSecretConfigured = ref(false)
  const oauthClientSecretInputId = ref(OAUTH_CLIENT_SECRET_ID)
  const oauthClientSecretTemplate = ref('')
  const oauthScopesText = ref('')
  const oauthCallbackPort = ref('')
  const oauthAuthServerMetadataUrl = ref('')
  let hydrating = false

  const resetOAuthFields = (): void => {
    oauthClientId.value = ''
    asAllowlistText.value = ''
    oauthClientSecret.value = ''
    oauthClientSecretConfigured.value = false
    oauthClientSecretInputId.value = OAUTH_CLIENT_SECRET_ID
    oauthClientSecretTemplate.value = ''
    oauthScopesText.value = ''
    oauthCallbackPort.value = ''
    oauthAuthServerMetadataUrl.value = ''
  }

  const resetFromProps = async (): Promise<void> => {
    hydrating = true
    try {
      draftId.value = props.serverId ?? ''
      const config = props.initialConfig
      if (!config) {
        transport.value = 'stdio'
        command.value = 'npx'
        argsText.value = ''
        url.value = ''
        envRows.value = []
        headerRows.value = []
        authMode.value = 'none'
        resetOAuthFields()
        return
      }

      const serverId = props.serverId ?? null

      if (isMcpHttpServer(config)) {
        transport.value = config.type
        url.value = config.url
        headerRows.value = await recordToSecretRows(config.headers, serverId)
        envRows.value = []
        command.value = 'npx'
        argsText.value = ''
        authMode.value = getMcpAuthMode(config)
        oauthClientId.value = config.oauth?.clientId ?? ''
        asAllowlistText.value = (config.oauth?.allowedAuthorizationServers ?? []).join('\n')
        oauthScopesText.value = (config.oauth?.scopes ?? []).join(', ')
        oauthCallbackPort.value =
          config.oauth?.callbackPort !== undefined ? String(config.oauth.callbackPort) : ''
        oauthAuthServerMetadataUrl.value = config.oauth?.authServerMetadataUrl ?? ''
        oauthClientSecret.value = ''
        const secretTemplate = config.oauth?.clientSecret ?? ''
        oauthClientSecretTemplate.value = secretTemplate
        const secretInputId = inputIdFromValue(secretTemplate) ?? OAUTH_CLIENT_SECRET_ID
        oauthClientSecretInputId.value = secretInputId
        oauthClientSecretConfigured.value =
          Boolean(inputIdFromValue(secretTemplate)) &&
          serverId !== null &&
          serverId.length > 0
            ? await probeConfigured(serverId, secretInputId)
            : false
        return
      }

      if (isMcpStdioServer(config)) {
        transport.value = 'stdio'
        command.value = config.command
        argsText.value = (config.args ?? []).join(', ')
        envRows.value = await recordToSecretRows(config.env, serverId)
        headerRows.value = []
        authMode.value = 'none'
        resetOAuthFields()
      }
    } finally {
      hydrating = false
    }
  }

  watch(
    authMode,
    (mode) => {
      if (hydrating) {
        return
      }
      if (mode !== 'headers') {
        headerRows.value = []
      }
    },
    { flush: 'sync' },
  )

  watch(
    () => [props.open, props.serverId, props.initialConfig] as const,
    ([open]) => {
      if (!open) {
        return
      }
      resetFromProps().catch((error: unknown) => {
        toast.error('Failed to load server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    },
  )

  onMounted(() => {
    if (props.open) {
      resetFromProps().catch((error: unknown) => {
        toast.error('Failed to load server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
  })

  const addEnvRow = (): void => {
    envRows.value = [...envRows.value, { key: '', value: '', configured: false }]
  }

  const addHeaderRow = (): void => {
    headerRows.value = [
      ...headerRows.value,
      { key: '', value: '', configured: false },
    ]
  }

  const handleSave = (): void => {
    const serverId = draftId.value.trim()
    if (!serverId) {
      toast.error('Server ID is required')
      return
    }

    let config: McpServerConfig
    let inputs: McpInputDefinition[] = []
    let secretValues: Record<string, string> = {}

    if (transport.value === 'stdio') {
      const built = buildSecretRecord(envRows.value)
      inputs = built.inputs
      secretValues = built.secretValues
      const stdio: McpStdioServer = {
        command: command.value.trim(),
        args: argsText.value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
        env: built.record,
      }
      if (!stdio.command) {
        toast.error('Command is required')
        return
      }
      const commandError = validateMcpStdioCommand(stdio.command)
      if (commandError) {
        toast.error(commandError)
        return
      }
      const missingKey = missingSecretRowKey(envRows.value)
      if (missingKey) {
        toast.error('Secret value required', {
          description: `Enter a value for ${missingKey}, or remove that row.`,
        })
        return
      }
      config = stdio
    } else {
      const built = buildHttpServerConfig({
        transport: transport.value,
        url: url.value,
        authMode: authMode.value,
        headerRows: headerRows.value,
        oauthClientId: oauthClientId.value,
        asAllowlistText: asAllowlistText.value,
        oauthClientSecret: oauthClientSecret.value,
        oauthClientSecretInputId: oauthClientSecretInputId.value,
        oauthClientSecretTemplate: oauthClientSecretTemplate.value,
        oauthScopesText: oauthScopesText.value,
        oauthCallbackPort: oauthCallbackPort.value,
        oauthAuthServerMetadataUrl: oauthAuthServerMetadataUrl.value,
      })
      if (!built.ok) {
        return
      }
      config = built.config
      inputs = built.inputs
      secretValues = built.secretValues
    }

    emit('save', {
      serverId,
      previousId: props.mode === 'edit' ? (props.serverId ?? undefined) : undefined,
      config,
      inputs,
      secretValues,
    })
    emit('update:open', false)
  }

  return {
    draftId,
    transport,
    command,
    argsText,
    url,
    envRows,
    headerRows,
    authMode,
    oauthClientId,
    asAllowlistText,
    oauthClientSecret,
    oauthClientSecretConfigured,
    oauthScopesText,
    oauthCallbackPort,
    oauthAuthServerMetadataUrl,
    addEnvRow,
    addHeaderRow,
    handleSave,
  }
}
