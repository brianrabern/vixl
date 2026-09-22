import { describe, expect, it } from 'vitest'
import type { ModelMessage } from 'ai'
import truncateModelMessage, {
  omitCompactFileParts,
} from '@/services/harness/compact/truncate-model-message'

describe('omitCompactFileParts', () => {
  it('replaces user file and image parts with a placeholder', () => {
    const message: ModelMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'See screenshot' },
        {
          type: 'file',
          mediaType: 'image/png',
          data: 'A'.repeat(8_000),
        },
        {
          type: 'image',
          image: 'B'.repeat(8_000),
        },
      ],
    }

    const omitted = omitCompactFileParts(message)

    expect(omitted).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'See screenshot' },
        { type: 'text', text: '[image omitted by compaction]' },
        { type: 'text', text: '[image omitted by compaction]' },
      ],
    })
  })

  it('replaces assistant file parts with a placeholder', () => {
    const message: ModelMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Rendered preview' },
        {
          type: 'file',
          mediaType: 'image/png',
          data: 'C'.repeat(4_000),
        },
      ],
    }

    expect(omitCompactFileParts(message)).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Rendered preview' },
        { type: 'text', text: '[image omitted by compaction]' },
      ],
    })
  })

  it('leaves string content unchanged', () => {
    const message: ModelMessage = { role: 'user', content: 'plain' }
    expect(omitCompactFileParts(message)).toBe(message)
  })
})

describe('truncateModelMessage', () => {
  it('omits file parts before clipping so base64 does not survive', () => {
    const message: ModelMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'See screenshot' },
        {
          type: 'file',
          mediaType: 'image/png',
          data: 'D'.repeat(80_000),
        },
      ],
    }

    const truncated = truncateModelMessage(message, 32)

    expect(JSON.stringify(truncated)).not.toContain('D'.repeat(1000))
    expect(JSON.stringify(truncated)).toContain(
      '[image omitted by compaction]',
    )
  })

  it('still clips oversized text after file parts are omitted', () => {
    const message: ModelMessage = {
      role: 'user',
      content: 'x'.repeat(80_000),
    }

    const truncated = truncateModelMessage(message, 32)

    expect(typeof truncated.content === 'string' ? truncated.content : '').toContain(
      '[truncated for compaction]',
    )
    expect(JSON.stringify(truncated).length).toBeLessThan(
      JSON.stringify(message).length,
    )
  })
})
