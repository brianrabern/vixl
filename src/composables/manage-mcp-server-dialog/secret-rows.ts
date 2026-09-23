import type { McpInputDefinition } from '@/types/vixl/mcp-config'
import { mcpInputKey } from '@/services/mcp/mcp-keychain-keys'
import { getSecret } from '@/services/vixl/vixl-tauri'

export type SecretRow = {
  key: string
  /** New secret value. Empty means keep existing keychain value when configured. */
  value: string
  configured: boolean
}

const INPUT_TEMPLATE = /^\$\{input:([^}]+)\}$/

export const OAUTH_CLIENT_SECRET_ID = 'oauth_client_secret'

export const templateRef = (key: string): string => `\${input:${key}}`

export const inputIdFromValue = (value: string): string | null => {
  const match = value.trim().match(INPUT_TEMPLATE)
  return match?.[1] ?? null
}

export const probeConfigured = async (
  serverId: string,
  inputId: string,
): Promise<boolean> => {
  const stored = await getSecret(mcpInputKey(serverId, inputId))
  return stored !== null && stored.length > 0
}

export const recordToSecretRows = async (
  record: Record<string, string> | undefined,
  serverId: string | null,
): Promise<SecretRow[]> => {
  const entries = Object.entries(record ?? {})
  const rows: SecretRow[] = []
  for (const [key, rawValue] of entries) {
    const inputId = inputIdFromValue(rawValue) ?? key
    const configured =
      serverId !== null && serverId.length > 0
        ? await probeConfigured(serverId, inputId)
        : false
    rows.push({
      key,
      value: '',
      configured,
    })
  }
  return rows
}

export const buildSecretRecord = (
  rows: SecretRow[],
): {
  record?: Record<string, string>
  inputs: McpInputDefinition[]
  secretValues: Record<string, string>
} => {
  const record: Record<string, string> = {}
  const inputs: McpInputDefinition[] = []
  const secretValues: Record<string, string> = {}
  const seenInputs = new Set<string>()

  for (const row of rows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    const inputId = key
    record[key] = templateRef(inputId)
    if (!seenInputs.has(inputId)) {
      seenInputs.add(inputId)
      inputs.push({
        id: inputId,
        type: 'promptString',
        description: inputId,
        password: true,
      })
    }
    const nextValue = row.value.trim()
    if (nextValue.length > 0) {
      secretValues[inputId] = nextValue
    }
  }

  return {
    record: Object.keys(record).length > 0 ? record : undefined,
    inputs,
    secretValues,
  }
}

export const missingSecretRowKey = (rows: SecretRow[]): string | null => {
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    if (!row.configured && row.value.trim().length === 0) {
      return key
    }
  }
  return null
}
