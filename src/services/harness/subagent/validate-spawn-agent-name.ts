import resolveAgentDefinition, {
  listAgentIndex,
} from '@/services/agents/resolve-agent-definition'
import type { ResolvedAgentDefinition } from '@/types/agents'

const NON_AGENT_TYPE_SLUGS = new Set(['shell', 'generalpurpose'])

const normalizeTypeSlug = (value: string): string =>
  value.trim().toLowerCase().replace(/[-_]/g, '')

const isReservedNonAgentSlug = (agentName: string): boolean => {
  const trimmed = agentName.trim()
  if (trimmed.length === 0 || /\s/.test(trimmed)) {
    return false
  }
  return NON_AGENT_TYPE_SLUGS.has(normalizeTypeSlug(trimmed))
}

const isReasonableVerbPhrase = (agentName: string): boolean => {
  const words = agentName.trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length < 2 || words.length > 6) {
    return false
  }
  return words.every((word) => /^[A-Za-z][A-Za-z0-9'-]*$/.test(word))
}

const normalizeVerbPhraseSeparators = (agentName: string): string =>
  agentName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()

const catalogNamesLabel = async (projectRoot: string | null): Promise<string> => {
  const catalog = await listAgentIndex(projectRoot).catch(() => [])
  const names = [...new Set(catalog.map((entry) => entry.name))].sort((left, right) =>
    left.localeCompare(right),
  )
  if (names.length === 0) {
    return 'none defined'
  }
  return names.join(', ')
}

const throwUnknownAgent = async (
  projectRoot: string | null,
  agentName: string,
): Promise<never> => {
  const catalogList = await catalogNamesLabel(projectRoot)
  throw new Error(
    `Unknown agentName "${agentName}". It is not in the agent catalog. Valid catalog names: ${catalogList}. Use a catalog name, or a 2-6 word verb phrase for a generic helper.`,
  )
}

const validateSpawnAgentName = async (
  projectRoot: string | null,
  agentName: string,
): Promise<ResolvedAgentDefinition | null> => {
  const resolved = await resolveAgentDefinition(projectRoot, agentName).catch(() => null)
  if (resolved) {
    return resolved
  }

  if (isReservedNonAgentSlug(agentName)) {
    await throwUnknownAgent(projectRoot, agentName)
  }

  if (!isReasonableVerbPhrase(agentName)) {
    const normalized = normalizeVerbPhraseSeparators(agentName)
    if (!isReasonableVerbPhrase(normalized)) {
      await throwUnknownAgent(projectRoot, agentName)
    }
  }

  return null
}

export default validateSpawnAgentName
