import type {
  ModelMessage,
  ToolCallPart,
  ToolContent,
  ToolResultPart,
} from 'ai'
import estimateTextTokens from '@/utils/estimate-text-tokens'
import modelMessageText from './model-message-text'

const CHARS_PER_TOKEN = 4
const TRUNCATION_SUFFIX = '\n[truncated for compaction]'
const FILE_OMITTED_PLACEHOLDER = '[image omitted by compaction]'

const omittedFilePart = (): { type: 'text'; text: string } => ({
  type: 'text',
  text: FILE_OMITTED_PLACEHOLDER,
})

export const omitCompactFileParts = (message: ModelMessage): ModelMessage => {
  if (typeof message.content === 'string') {
    return message
  }

  if (message.role === 'user') {
    let changed = false
    const content = message.content.map((part) => {
      if (part.type === 'file' || part.type === 'image') {
        changed = true
        return omittedFilePart()
      }
      return part
    })
    return changed ? { ...message, content } : message
  }

  if (message.role === 'assistant') {
    let changed = false
    const content = message.content.map((part) => {
      if (part.type === 'file' || part.type === 'reasoning-file') {
        changed = true
        return omittedFilePart()
      }
      return part
    })
    return changed ? { ...message, content } : message
  }

  return message
}

const clip = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value
  }
  const sliceLen = Math.max(0, maxChars - TRUNCATION_SUFFIX.length)
  return `${value.slice(0, sliceLen)}${TRUNCATION_SUFFIX}`
}

const truncateOutput = (
  output: ToolResultPart['output'],
  maxChars: number,
): ToolResultPart['output'] => {
  if (output.type === 'text') {
    return { type: 'text', value: clip(output.value, maxChars) }
  }
  return { type: 'text', value: clip(JSON.stringify(output), maxChars) }
}

const truncateToolResult = (
  part: ToolResultPart,
  maxChars: number,
): ToolResultPart => ({
  ...part,
  output: truncateOutput(part.output, maxChars),
})

const truncateToolCall = (
  part: ToolCallPart,
  maxChars: number,
): ToolCallPart => {
  const inputRaw = JSON.stringify(part.input ?? {})
  if (inputRaw.length <= maxChars) {
    return part
  }
  return { ...part, input: { truncated: clip(inputRaw, maxChars) } }
}

const truncateToolContent = (
  content: ToolContent,
  maxChars: number,
): ToolContent =>
  content.map((part) => {
    if (part.type === 'tool-result') {
      return truncateToolResult(part, maxChars)
    }
    return part
  })

export default (message: ModelMessage, maxTokens: number): ModelMessage => {
  const next = omitCompactFileParts(message)
  const serialized = JSON.stringify(next)
  if (estimateTextTokens(serialized) <= maxTokens) {
    return next
  }

  const maxChars = Math.max(0, maxTokens * CHARS_PER_TOKEN)
  const raw = modelMessageText(next)
  const overhead = Math.max(0, serialized.length - raw.length)
  const contentChars = Math.max(0, maxChars - overhead)

  if (next.role === 'system') {
    return { ...next, content: clip(next.content, contentChars) }
  }

  if (next.role === 'tool') {
    return {
      ...next,
      content: truncateToolContent(next.content, contentChars),
    }
  }

  if (next.role === 'user') {
    if (typeof next.content === 'string') {
      return { ...next, content: clip(next.content, contentChars) }
    }
    return {
      ...next,
      content: next.content.map((part) => {
        if (part.type === 'text') {
          return { ...part, text: clip(part.text, contentChars) }
        }
        if (part.type === 'file' || part.type === 'image') {
          return omittedFilePart()
        }
        return part
      }),
    }
  }

  if (typeof next.content === 'string') {
    return { ...next, content: clip(next.content, contentChars) }
  }

  return {
    ...next,
    content: next.content.map((part) => {
      if (part.type === 'text') {
        return { ...part, text: clip(part.text, contentChars) }
      }
      if (part.type === 'file' || part.type === 'reasoning-file') {
        return omittedFilePart()
      }
      if (part.type === 'tool-result') {
        return truncateToolResult(part, contentChars)
      }
      if (part.type === 'tool-call') {
        return truncateToolCall(part, contentChars)
      }
      return part
    }),
  }
}
