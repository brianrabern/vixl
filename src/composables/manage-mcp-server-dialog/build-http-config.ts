import { toast } from 'vue-sonner'
import { z } from 'zod'
import { isMcpTemplatableUrl } from '@/schemas/mcp-config'
import type {
  McpHttpServer,
  McpInputDefinition,
  McpOAuthConfig,
} from '@/types/vixl/mcp-config'
import {
  buildSecretRecord,
  inputIdFromValue,
  missingSecretRowKey,
  OAUTH_CLIENT_SECRET_ID,
  templateRef,
  type SecretRow,
} from './secret-rows'

export type HttpAuthMode = 'none' | 'headers' | 'oauth'

export type HttpFormState = {
  transport: 'http' | 'sse'
  url: string
  authMode: HttpAuthMode
  headerRows: SecretRow[]
  oauthClientId: string
  asAllowlistText: string
  oauthClientSecret: string
  oauthClientSecretInputId: string
  oauthClientSecretTemplate: string
  oauthScopesText: string
  oauthCallbackPort: string
  oauthAuthServerMetadataUrl: string
}

export type BuildHttpConfigResult =
  | { ok: false }
  | {
      ok: true
      config: McpHttpServer
      inputs: McpInputDefinition[]
      secretValues: Record<string, string>
    }

const commaList = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

const lineList = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const oauthInput = (id: string): McpInputDefinition => ({
  id,
  type: 'promptString',
  description: id,
  password: true,
})

const configUrlSchema = z.string().url()

const isConfigUrl = (value: string): boolean => configUrlSchema.safeParse(value).success

const buildOAuthConfig = (
  form: HttpFormState,
): { oauth: McpOAuthConfig; inputs: McpInputDefinition[]; secretValues: Record<string, string> } | null => {
  const oauth: McpOAuthConfig = {}
  const clientId = form.oauthClientId.trim()
  if (clientId) {
    oauth.clientId = clientId
  }
  const allowlist = lineList(form.asAllowlistText)
  for (const entry of allowlist) {
    if (!isConfigUrl(entry)) {
      toast.error(`Invalid authorization server URL: ${entry}`)
      return null
    }
  }
  if (allowlist.length > 0) {
    oauth.allowedAuthorizationServers = allowlist
  }
  const scopes = commaList(form.oauthScopesText)
  if (scopes.length > 0) {
    oauth.scopes = scopes
  }
  const portText = form.oauthCallbackPort.trim()
  if (portText) {
    const port = Number(portText)
    if (!Number.isInteger(port) || port <= 0) {
      toast.error('Callback port must be a positive integer')
      return null
    }
    oauth.callbackPort = port
  }
  const metadataUrl = form.oauthAuthServerMetadataUrl.trim()
  if (metadataUrl) {
    if (!isConfigUrl(metadataUrl)) {
      toast.error(`Invalid authorization server metadata URL: ${metadataUrl}`)
      return null
    }
    oauth.authServerMetadataUrl = metadataUrl
  }

  let inputs: McpInputDefinition[] = []
  let secretValues: Record<string, string> = {}
  const secretInputId = form.oauthClientSecretInputId || OAUTH_CLIENT_SECRET_ID
  const nextSecret = form.oauthClientSecret.trim()
  if (nextSecret) {
    oauth.clientSecret = templateRef(secretInputId)
    inputs = [oauthInput(secretInputId)]
    secretValues = { [secretInputId]: nextSecret }
  } else if (form.oauthClientSecretTemplate) {
    oauth.clientSecret = form.oauthClientSecretTemplate
    const existingInputId = inputIdFromValue(form.oauthClientSecretTemplate)
    if (existingInputId) {
      inputs = [oauthInput(existingInputId)]
    }
  }

  return { oauth, inputs, secretValues }
}

export const buildHttpServerConfig = (form: HttpFormState): BuildHttpConfigResult => {
  const http: McpHttpServer = {
    type: form.transport,
    url: form.url.trim(),
    auth: form.authMode,
  }
  if (!http.url) {
    toast.error('URL is required')
    return { ok: false }
  }
  if (!isMcpTemplatableUrl(http.url)) {
    toast.error(`Invalid MCP server URL: ${http.url}`)
    return { ok: false }
  }

  if (form.authMode === 'headers') {
    const built = buildSecretRecord(form.headerRows)
    if (!built.record) {
      toast.error('At least one header is required')
      return { ok: false }
    }
    const missingKey = missingSecretRowKey(form.headerRows)
    if (missingKey) {
      toast.error('Secret value required', {
        description: `Enter a value for ${missingKey}, or remove that row.`,
      })
      return { ok: false }
    }
    http.headers = built.record
    return {
      ok: true,
      config: http,
      inputs: built.inputs,
      secretValues: built.secretValues,
    }
  }

  if (form.authMode === 'oauth') {
    const oauthBuilt = buildOAuthConfig(form)
    if (!oauthBuilt) {
      return { ok: false }
    }
    if (Object.keys(oauthBuilt.oauth).length > 0) {
      http.oauth = oauthBuilt.oauth
    }
    const headerBuilt = buildSecretRecord(form.headerRows)
    if (headerBuilt.record) {
      const missingKey = missingSecretRowKey(form.headerRows)
      if (missingKey) {
        toast.error('Secret value required', {
          description: `Enter a value for ${missingKey}, or remove that row.`,
        })
        return { ok: false }
      }
      http.headers = headerBuilt.record
    }
    return {
      ok: true,
      config: http,
      inputs: [...headerBuilt.inputs, ...oauthBuilt.inputs],
      secretValues: { ...headerBuilt.secretValues, ...oauthBuilt.secretValues },
    }
  }

  return {
    ok: true,
    config: http,
    inputs: [],
    secretValues: {},
  }
}
