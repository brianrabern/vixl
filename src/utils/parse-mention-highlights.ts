import type { MentionHighlight } from '@/types/chat/mention-highlight'

export default (value: unknown): MentionHighlight[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  const highlights: MentionHighlight[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    if (
      (record.kind !== 'mention' &&
        record.kind !== 'skill' &&
        record.kind !== 'agent') ||
      typeof record.token !== 'string'
    ) {
      continue
    }
    highlights.push({ kind: record.kind, token: record.token })
  }
  return highlights.length > 0 ? highlights : undefined
}
