import { describe, expect, it } from 'vitest'
import {
  formatMentionBlocks,
  formatMentionsAsText,
} from '@/services/context/system-prompt-parts/format-mentions'
import type { ContextMention } from '@/types/harness/context-mention'

const fileMention: ContextMention = {
  type: 'file',
  path: 'src/utils/foo.ts',
  content: 'export const foo = 1',
}

describe('format-mentions', () => {
  it('formats a file mention as a readable text block', () => {
    const text = formatMentionsAsText([fileMention])

    expect(text).toContain('File src/utils/foo.ts:')
    expect(text).toContain('export const foo = 1')
  })

  it('splits skills from other mentions in formatMentionBlocks', () => {
    const blocks = formatMentionBlocks([fileMention, { type: 'skill', name: 'ask' }])

    expect(blocks.skills).toBe('Skill ask')
    expect(blocks.skills).not.toContain('Call load_skill')
    expect(blocks.skills).not.toContain('before acting')
    expect(blocks.mentions).toContain('File src/utils/foo.ts:')
    expect(blocks.mentions).toContain('export const foo = 1')
  })

  it('formats skill mentions as Skill name lines', () => {
    const text = formatMentionsAsText([{ type: 'skill', name: 'ask' }])

    expect(text).toBe('Skill ask')
    expect(text).not.toContain('Call load_skill')
    expect(text).not.toContain('before acting')
  })

  it('does not prefix an empty skills mention block', () => {
    const blocks = formatMentionBlocks([fileMention])

    expect(blocks.skills).toBe('')
    expect(blocks.skills).not.toContain('load_skill')
  })

  it('omits agent mentions from untrusted Context and Skill lines', () => {
    const mentions = [
      fileMention,
      { type: 'skill' as const, name: 'ask' },
      { type: 'agent' as const, name: 'reviewer' },
    ]

    expect(formatMentionsAsText(mentions)).not.toContain('reviewer')
    expect(formatMentionsAsText(mentions)).not.toContain('Skill reviewer')
    expect(formatMentionsAsText(mentions)).toContain('File src/utils/foo.ts:')
    expect(formatMentionsAsText(mentions)).toContain('Skill ask')
    expect(formatMentionsAsText(mentions)).not.toContain('Call load_skill')
    expect(formatMentionsAsText(mentions)).not.toContain('before acting')

    const blocks = formatMentionBlocks(mentions)
    expect(blocks.skills).toBe('Skill ask')
    expect(blocks.mentions).not.toContain('reviewer')
    expect(blocks.skills).not.toContain('reviewer')
  })
})
