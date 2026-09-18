import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentIndexEntry, ResolvedAgentDefinition } from '@/types/agents'

const resolveAgentDefinition = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<ResolvedAgentDefinition | null>>(),
)
const listAgentIndex = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<AgentIndexEntry[]>>(),
)

vi.mock('@/services/agents/resolve-agent-definition', () => ({
  default: (...args: unknown[]) => resolveAgentDefinition(...args),
  listAgentIndex: (...args: unknown[]) => listAgentIndex(...args),
}))

import validateSpawnAgentName from '@/services/harness/subagent/validate-spawn-agent-name'

const catalogExplorer: AgentIndexEntry = {
  id: 'explorer',
  name: 'explorer',
  description: 'Explore the repo',
  scope: 'project',
  path: '/tmp/project/.vixl/agents/explorer.md',
}

const explorerDefinition: ResolvedAgentDefinition = {
  id: 'explorer',
  name: 'explorer',
  description: 'Explore the repo',
  body: '',
  path: catalogExplorer.path,
  scope: 'project',
}

describe('validateSpawnAgentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAgentIndex.mockResolvedValue([catalogExplorer])
  })

  it('allows catalog agents', async () => {
    resolveAgentDefinition.mockResolvedValue(explorerDefinition)
    await expect(validateSpawnAgentName('/tmp/project', 'explorer')).resolves.toEqual(
      explorerDefinition,
    )
    expect(listAgentIndex).not.toHaveBeenCalled()
  })

  it('allows a 2-6 word verb phrase when the catalog has no match', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(
      validateSpawnAgentName('/tmp/project', 'Reading auth'),
    ).resolves.toBeNull()
    expect(listAgentIndex).not.toHaveBeenCalled()
  })

  it('rejects unresolved names and lists catalog names', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(validateSpawnAgentName('/tmp/project', 'shell')).rejects.toThrow(
      /Unknown agentName "shell".*Valid catalog names: explorer/,
    )
    expect(listAgentIndex).toHaveBeenCalledWith('/tmp/project')
  })

  it('rejects generalPurpose when it is not in the catalog', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(
      validateSpawnAgentName('/tmp/project', 'generalPurpose'),
    ).rejects.toThrow(/Unknown agentName "generalPurpose"/)
  })

  it('allows a kebab-case verb phrase when the catalog has no match', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(validateSpawnAgentName('/tmp/project', 'run-ci')).resolves.toBeNull()
    expect(listAgentIndex).not.toHaveBeenCalled()
  })

  it('allows an underscored verb phrase when the catalog has no match', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(
      validateSpawnAgentName('/tmp/project', 'review_bugbot'),
    ).resolves.toBeNull()
    expect(listAgentIndex).not.toHaveBeenCalled()
  })

  it('rejects a single-word name that is not in the catalog', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(validateSpawnAgentName('/tmp/project', 'explore')).rejects.toThrow(
      /Unknown agentName "explore".*Valid catalog names: explorer/,
    )
  })

  it('rejects a 7 word verb phrase', async () => {
    resolveAgentDefinition.mockResolvedValue(null)
    await expect(
      validateSpawnAgentName(
        '/tmp/project',
        'one two three four five six seven',
      ),
    ).rejects.toThrow(/Unknown agentName "one two three four five six seven"/)
  })
})
