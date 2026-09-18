import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { TodoItem } from '@/types/harness/harness-event'
import buildSubagentTimeline from '@/utils/build-subagent-timeline'
import formatTranscriptToolRun from '@/utils/format-transcript-tool-run'

const serializeMessageText = (message: UIMessage): string =>
  message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text
      }
      return JSON.stringify(part)
    })
    .join('\n')
    .trim()

const serializeUser = (message: UIMessage): string => {
  const body = serializeMessageText(message)
  return `USER:\n${body || '(empty)'}`
}

const serializeAgentTurn = (turn: AgentTurn): string => {
  const parts: string[] = []
  for (const step of turn.steps) {
    const reasoning = step.reasoning.trim()
    if (reasoning.length > 0) {
      parts.push(reasoning)
    }
    const text = step.text.trim()
    if (text.length > 0) {
      parts.push(text)
    }
    parts.push(...step.tools.map(formatTranscriptToolRun))
  }
  const trailingText = turn.text.trim()
  if (trailingText.length > 0) {
    parts.push(trailingText)
  }
  if (turn.error) {
    parts.push(`error (${turn.error.kind}): ${turn.error.message}`)
  }
  const body = parts.filter((value) => value.length > 0).join('\n')
  return `ASSISTANT:\n${body || '(empty)'}`
}

const serializeTodos = (todos: TodoItem[]): string => {
  const lines = todos.map((todo) => `[${todo.status}] ${todo.content}`)
  return `TODO:\n${lines.join('\n') || '(empty)'}`
}

const appendSubagentEventLines = (
  lines: string[],
  item: SubagentTimelineItem,
): void => {
  const promptId = `${item.subagentId}-prompt`
  for (const timelineItem of buildSubagentTimeline(item)) {
    if (timelineItem.type === 'agent-turn') {
      for (const step of timelineItem.turn.steps) {
        lines.push(...step.tools.map(formatTranscriptToolRun))
      }
      continue
    }
    if (timelineItem.type === 'compaction') {
      lines.push(`compaction: ${timelineItem.summary.trim() || '(empty)'}`)
      const focus = timelineItem.focus?.trim() ?? ''
      if (focus.length > 0) {
        lines.push(`focus: ${focus}`)
      }
      continue
    }
    if (timelineItem.type !== 'user' || timelineItem.message.id === promptId) {
      continue
    }
    const message = serializeMessageText(timelineItem.message)
    if (message.length > 0) {
      lines.push(`steer: ${message}`)
    }
  }
}

const serializeSubagent = (item: SubagentTimelineItem): string => {
  const lines = [`SUBAGENT ${item.name} [${item.status}]`]
  const prompt = item.prompt?.trim() ?? ''
  if (prompt.length > 0) {
    lines.push(prompt)
  }
  appendSubagentEventLines(lines, item)
  const summary = item.summary?.trim() ?? ''
  if (summary.length > 0) {
    lines.push(`summary: ${summary}`)
  }
  return lines.join('\n')
}

const serializeCompaction = (summary: string, focus: string | null): string => {
  const lines = [`COMPACTION:\n${summary.trim() || '(empty)'}`]
  const focusText = focus?.trim() ?? ''
  if (focusText.length > 0) {
    lines.push(`focus: ${focusText}`)
  }
  return lines.join('\n')
}

const serializeItem = (item: ChatTimelineItem): string => {
  switch (item.type) {
    case 'user':
      return serializeUser(item.message)
    case 'agent-turn':
      return serializeAgentTurn(item.turn)
    case 'todo':
      return serializeTodos(item.todos)
    case 'subagent':
      return serializeSubagent(item)
    case 'compaction':
      return serializeCompaction(item.summary, item.focus)
  }
}

export default (items: ChatTimelineItem[]): string => {
  if (items.length === 0) {
    return '(empty conversation)'
  }

  return items.map(serializeItem).join('\n\n')
}
