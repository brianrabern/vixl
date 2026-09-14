import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'

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
): AgentTurn => {
  const segmented = subagent.compactions.length > 0
  return {
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
  }
}

const turnHasContent = (
  turn: AgentTurn,
  includeRunning: boolean,
  status: SubagentTimelineItem['status'],
): boolean =>
  turn.text.length > 0 ||
  turn.steps.some((step) => step.tools.length > 0) ||
  (includeRunning && status === 'running')

const appendSteerMessages = (
  items: ChatTimelineItem[],
  subagent: SubagentTimelineItem,
): void => {
  const delivered = subagent.steers ?? []
  const pending = subagent.pendingSteers ?? []
  const messages = [...delivered, ...pending]
  for (const [index, text] of messages.entries()) {
    const trimmed = text.trim()
    if (!trimmed) {
      continue
    }
    items.push(
      userItem(`${subagent.subagentId}-steer-${index}`, trimmed, subagent.model),
    )
  }
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

  if (subagent.compactions.length === 0) {
    const turn = buildTurn(subagent, 0, subagent.tools, subagent.summary?.trim() ?? '')
    if (turnHasContent(turn, true, subagent.status)) {
      items.push({ type: 'agent-turn', turn })
    }
    appendSteerMessages(items, subagent)
    return items
  }

  let previousBoundary = 0
  let turnIndex = 0

  for (const compaction of subagent.compactions) {
    const tools = subagent.tools.slice(previousBoundary, compaction.toolBoundary)
    if (tools.length > 0) {
      items.push({
        type: 'agent-turn',
        turn: buildTurn(subagent, turnIndex, tools, ''),
      })
      turnIndex += 1
    }
    items.push({
      type: 'compaction',
      summary: compaction.summary,
      focus: compaction.focus,
    })
    previousBoundary = compaction.toolBoundary
  }

  const trailing = buildTurn(
    subagent,
    turnIndex,
    subagent.tools.slice(previousBoundary),
    subagent.summary?.trim() ?? '',
  )
  if (turnHasContent(trailing, true, subagent.status)) {
    items.push({ type: 'agent-turn', turn: trailing })
  }

  appendSteerMessages(items, subagent)
  return items
}
