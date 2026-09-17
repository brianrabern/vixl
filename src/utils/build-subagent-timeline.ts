import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'

type TimelineBoundary =
  | {
      kind: 'compaction'
      toolBoundary: number
      summary: string
      focus: string | null
    }
  | {
      kind: 'steer'
      toolBoundary: number
      message: string
      steerIndex: number
    }

const userItem = (
  id: string,
  text: string,
  model?: string,
): ChatTimelineItem => {
  const message: UIMessage = {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: model ? { model } : undefined,
  }
  return { type: 'user', message }
}

const buildTurn = (
  subagent: SubagentTimelineItem,
  turnIndex: number,
  tools: ToolRun[],
  text: string,
  segmented: boolean,
): AgentTurn => ({
  id: segmented
    ? `${subagent.subagentId}-turn-${turnIndex}`
    : `${subagent.subagentId}-turn`,
  text,
  steps: [
    {
      id: segmented
        ? `${subagent.subagentId}-step-${turnIndex}`
        : `${subagent.subagentId}-step`,
      text: '',
      reasoning: '',
      tools,
    },
  ],
})

const turnHasContent = (
  turn: AgentTurn,
  includeRunning: boolean,
  status: SubagentTimelineItem['status'],
): boolean =>
  turn.text.length > 0 ||
  turn.steps.some((step) => step.tools.length > 0) ||
  (includeRunning && status === 'running')

const collectBoundaries = (subagent: SubagentTimelineItem): TimelineBoundary[] => {
  const boundaries: TimelineBoundary[] = [
    ...subagent.compactions.map(
      (compaction): TimelineBoundary => ({
        kind: 'compaction',
        toolBoundary: compaction.toolBoundary,
        summary: compaction.summary,
        focus: compaction.focus,
      }),
    ),
    ...(subagent.steers ?? []).flatMap((steer, steerIndex): TimelineBoundary[] => {
      const message = steer.message.trim()
      if (!message) {
        return []
      }
      return [
        {
          kind: 'steer',
          toolBoundary: steer.toolBoundary,
          message,
          steerIndex,
        },
      ]
    }),
  ]
  const kindRank = (kind: TimelineBoundary['kind']): number =>
    kind === 'steer' ? 0 : 1
  return boundaries.sort((left, right) => {
    const boundaryDiff = left.toolBoundary - right.toolBoundary
    if (boundaryDiff !== 0) {
      return boundaryDiff
    }
    return kindRank(left.kind) - kindRank(right.kind)
  })
}

const appendPendingSteerMessages = (
  items: ChatTimelineItem[],
  subagent: SubagentTimelineItem,
): void => {
  const deliveredCount = (subagent.steers ?? []).length
  for (const [offset, text] of (subagent.pendingSteers ?? []).entries()) {
    const trimmed = text.trim()
    if (!trimmed) {
      continue
    }
    items.push(
      userItem(
        `${subagent.subagentId}-steer-${deliveredCount + offset}`,
        trimmed,
        subagent.model,
      ),
    )
  }
}

const pushBoundaryItem = (
  items: ChatTimelineItem[],
  subagent: SubagentTimelineItem,
  boundary: TimelineBoundary,
): void => {
  if (boundary.kind === 'compaction') {
    items.push({
      type: 'compaction',
      summary: boundary.summary,
      focus: boundary.focus,
    })
    return
  }
  items.push(
    userItem(
      `${subagent.subagentId}-steer-${boundary.steerIndex}`,
      boundary.message,
      subagent.model,
    ),
  )
}

export default (subagent: SubagentTimelineItem): ChatTimelineItem[] => {
  const items: ChatTimelineItem[] = []

  if (subagent.prompt?.trim()) {
    items.push(
      userItem(
        `${subagent.subagentId}-prompt`,
        subagent.prompt.trim(),
        subagent.model,
      ),
    )
  }

  const boundaries = collectBoundaries(subagent)
  const segmented = boundaries.length > 0

  if (!segmented) {
    const turn = buildTurn(
      subagent,
      0,
      subagent.tools,
      subagent.summary?.trim() ?? '',
      false,
    )
    if (turnHasContent(turn, true, subagent.status)) {
      items.push({ type: 'agent-turn', turn })
    }
    appendPendingSteerMessages(items, subagent)
    return items
  }

  let previousBoundary = 0
  let turnIndex = 0

  for (const boundary of boundaries) {
    const tools = subagent.tools.slice(previousBoundary, boundary.toolBoundary)
    if (tools.length > 0) {
      items.push({
        type: 'agent-turn',
        turn: buildTurn(subagent, turnIndex, tools, '', true),
      })
      turnIndex += 1
    }
    pushBoundaryItem(items, subagent, boundary)
    previousBoundary = boundary.toolBoundary
  }

  const trailing = buildTurn(
    subagent,
    turnIndex,
    subagent.tools.slice(previousBoundary),
    subagent.summary?.trim() ?? '',
    true,
  )
  if (turnHasContent(trailing, true, subagent.status)) {
    items.push({ type: 'agent-turn', turn: trailing })
  }

  appendPendingSteerMessages(items, subagent)
  return items
}
