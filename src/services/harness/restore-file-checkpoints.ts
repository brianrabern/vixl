import aggregateToolRunFileDiffs from '@/services/harness/aggregate-tool-run-file-diffs'
import { fileCheckpointRestore } from '@/services/vixl/vixl-tauri'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type {
  ChatTimelineItem,
  SubagentTimelineItem,
} from '@/types/chat/chat-timeline-item'
import type {
  AggregatedTurnFileChange,
  FileCheckpointRestoreResult,
  FileCheckpointRestoreTarget,
} from '@/types/harness/file-checkpoint'

const toolsFromTurn = (turn: AgentTurn) =>
  turn.steps.flatMap((step) => step.tools)

export const aggregateTurnFileDiffs = (
  turn: AgentTurn,
): AggregatedTurnFileChange[] => aggregateToolRunFileDiffs(toolsFromTurn(turn))

export const aggregateSubagentFileDiffs = (
  subagent: SubagentTimelineItem,
  existing: AggregatedTurnFileChange[] = [],
): AggregatedTurnFileChange[] =>
  aggregateToolRunFileDiffs(subagent.tools, existing)

const aggregatedChangesForItem = (
  item: ChatTimelineItem,
): AggregatedTurnFileChange[] => {
  if (item.type === 'agent-turn') {
    return aggregateTurnFileDiffs(item.turn)
  }
  if (item.type === 'subagent') {
    return aggregateSubagentFileDiffs(item)
  }
  return []
}

export const collectMutationsAfterUserMessage = (
  timeline: ChatTimelineItem[],
  messageId: string,
): AggregatedTurnFileChange[] => {
  const index = timeline.findIndex(
    (item) => item.type === 'user' && item.message.id === messageId,
  )
  if (index < 0) {
    return []
  }

  let changes: AggregatedTurnFileChange[] = []
  for (const item of timeline.slice(index + 1)) {
    if (item.type === 'agent-turn') {
      changes = aggregateToolRunFileDiffs(toolsFromTurn(item.turn), changes)
      continue
    }
    if (item.type === 'subagent') {
      changes = aggregateSubagentFileDiffs(item, changes)
    }
  }

  return changes
}

/**
 * For each path mutated after boundary message M, pick the userMessageId in
 * effect when the first agent-turn or subagent item after M touched that path
 * (baseline key).
 */
export const resolveBaselinesForRevert = (
  timeline: ChatTimelineItem[],
  boundaryUserMessageId: string,
): FileCheckpointRestoreTarget[] => {
  const index = timeline.findIndex(
    (item) => item.type === 'user' && item.message.id === boundaryUserMessageId,
  )
  if (index < 0) {
    return []
  }

  const targets = new Map<string, string>()
  let currentUserMessageId = boundaryUserMessageId

  for (const item of timeline.slice(index + 1)) {
    if (item.type === 'user') {
      currentUserMessageId = item.message.id
      continue
    }
    for (const change of aggregatedChangesForItem(item)) {
      if (!targets.has(change.path)) {
        targets.set(change.path, currentUserMessageId)
      }
    }
  }

  return [...targets.entries()]
    .map(([path, userMessageId]) => ({ path, userMessageId }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Restore files for an agent turn: use the preceding user message as baseline key,
 * and include paths from this turn and all later mutations.
 */
export const resolveBaselinesForAgentTurn = (
  timeline: ChatTimelineItem[],
  turnId: string,
): { precedingUserMessageId: string | null; targets: FileCheckpointRestoreTarget[] } => {
  const turnIndex = timeline.findIndex(
    (item) => item.type === 'agent-turn' && item.turn.id === turnId,
  )
  if (turnIndex < 0) {
    return { precedingUserMessageId: null, targets: [] }
  }

  let precedingUserMessageId: string | null = null
  for (let i = turnIndex - 1; i >= 0; i -= 1) {
    const item = timeline[i]
    if (item?.type === 'user') {
      precedingUserMessageId = item.message.id
      break
    }
  }
  if (!precedingUserMessageId) {
    return { precedingUserMessageId: null, targets: [] }
  }

  return {
    precedingUserMessageId,
    targets: resolveBaselinesForRevert(timeline, precedingUserMessageId),
  }
}

export const restoreFileCheckpoints = async (args: {
  projectSlug: string
  chatId: string
  projectRoot: string
  targets: FileCheckpointRestoreTarget[]
}): Promise<FileCheckpointRestoreResult> => {
  if (args.targets.length === 0) {
    return { restored: [], deleted: [], skipped: [], errors: [] }
  }
  return fileCheckpointRestore({
    projectSlug: args.projectSlug,
    chatId: args.chatId,
    projectRoot: args.projectRoot,
    targets: args.targets,
  })
}

export const summarizeMutationCounts = (
  changes: AggregatedTurnFileChange[],
): { files: number; created: number; updated: number; deleted: number; renamed: number } => {
  let created = 0
  let updated = 0
  let deleted = 0
  let renamed = 0
  for (const change of changes) {
    if (change.operation === 'create') created += 1
    else if (change.operation === 'delete') deleted += 1
    else if (change.operation === 'rename') renamed += 1
    else updated += 1
  }
  return { files: changes.length, created, updated, deleted, renamed }
}

export default restoreFileCheckpoints
