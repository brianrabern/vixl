import { describe, expect, it } from 'vitest'
import parseMentionHighlights from '@/utils/parse-mention-highlights'

describe('parseMentionHighlights', () => {
  it('preserves agent kind highlights', () => {
    expect(
      parseMentionHighlights([{ kind: 'agent', token: '/bug-finder' }]),
    ).toEqual([{ kind: 'agent', token: '/bug-finder' }])
  })

  it('passes through skill and mention kinds', () => {
    expect(
      parseMentionHighlights([
        { kind: 'skill', token: '/ask' },
        { kind: 'mention', token: '@src/a.ts' },
      ]),
    ).toEqual([
      { kind: 'skill', token: '/ask' },
      { kind: 'mention', token: '@src/a.ts' },
    ])
  })

  it('drops unknown kinds', () => {
    expect(
      parseMentionHighlights([
        { kind: 'agent', token: '/reviewer' },
        { kind: 'other', token: '/nope' },
      ]),
    ).toEqual([{ kind: 'agent', token: '/reviewer' }])
  })

  it('drops non-string tokens', () => {
    expect(
      parseMentionHighlights([
        { kind: 'skill', token: '/ask' },
        { kind: 'mention', token: 12 },
      ]),
    ).toEqual([{ kind: 'skill', token: '/ask' }])
  })

  it('drops non-object entries', () => {
    expect(
      parseMentionHighlights([
        null,
        'agent',
        { kind: 'mention', token: '@src/a.ts' },
      ]),
    ).toEqual([{ kind: 'mention', token: '@src/a.ts' }])
  })

  it('returns undefined for non-array input', () => {
    expect(parseMentionHighlights(undefined)).toBeUndefined()
    expect(parseMentionHighlights({ kind: 'agent', token: '/reviewer' })).toBeUndefined()
  })

  it('returns undefined when no valid highlights remain', () => {
    expect(
      parseMentionHighlights([{ kind: 'other', token: '/nope' }, null, 3]),
    ).toBeUndefined()
    expect(parseMentionHighlights([])).toBeUndefined()
  })
})
