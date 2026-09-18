import { describe, expect, it } from 'vitest'
import wrapNestedTools from '@/services/harness/subagent/wrap-nested-tools'
import type { FileDiff } from '@/types/harness/file-diff'
import estimateTextTokens from '@/utils/estimate-text-tokens'

const TOKEN_CAP = 8000
const CHAR_CAP = TOKEN_CAP * 4
const DIFFS_REATTACH_CHAR_LIMIT = 32_000

const smallDiffs = (): FileDiff[] => [
  {
    path: 'src/a.ts',
    operation: 'update',
    hunks: [
      {
        oldStart: 1,
        newStart: 1,
        lines: [
          { kind: 'remove', content: 'old' },
          { kind: 'add', content: 'new' },
        ],
      },
    ],
  },
]

const wrapExecute = (result: unknown) => {
  const wrapped = wrapNestedTools({
    edit_file: {
      execute: async () => result,
    },
  })
  const execute = wrapped.edit_file?.execute
  if (!execute) {
    throw new Error('expected wrapped execute')
  }
  return execute
}

describe('wrapNestedTools diffs preservation', () => {
  it('passes a small result with diffs through unchanged', async () => {
    const result = { ok: true, diffs: smallDiffs() }
    const execute = wrapExecute(result)
    const output = await execute()
    expect(output).toBe(result)
  })

  it('passes a small result without diffs through unchanged', async () => {
    const result = { ok: true, path: 'src/a.ts' }
    const execute = wrapExecute(result)
    const output = await execute()
    expect(output).toBe(result)
  })

  it('reattaches valid diffs after capSerializedPreview', async () => {
    const diffs = smallDiffs()
    const result = {
      ok: true,
      body: 'x'.repeat(CHAR_CAP + 4000),
      diffs,
    }
    const execute = wrapExecute(result)
    const output = await execute()
    const serialized = JSON.stringify(result)

    expect(estimateTextTokens(serialized)).toBeGreaterThan(TOKEN_CAP)
    expect(output).not.toBe(result)
    expect(output).toEqual({
      truncated: true,
      preview: serialized.slice(0, CHAR_CAP),
      originalChars: serialized.length,
      diffs,
    })
  })

  it('drops diffs whose serialized size exceeds the reattach limit', async () => {
    const diffs: FileDiff[] = [
      {
        path: 'src/huge.ts',
        operation: 'update',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [{ kind: 'add', content: 'y'.repeat(DIFFS_REATTACH_CHAR_LIMIT + 1) }],
          },
        ],
      },
    ]
    expect(JSON.stringify(diffs).length).toBeGreaterThan(DIFFS_REATTACH_CHAR_LIMIT)

    const execute = wrapExecute({ ok: true, diffs })
    const output = await execute()

    expect(output).toMatchObject({ truncated: true })
    expect(output).not.toHaveProperty('diffs')
  })
})
