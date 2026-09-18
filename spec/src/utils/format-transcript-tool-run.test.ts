import { describe, expect, it } from 'vitest'
import type { ToolRun } from '@/types/harness/tool-run'
import formatTranscriptToolRun from '@/utils/format-transcript-tool-run'

const run = (partial: Partial<ToolRun> & Pick<ToolRun, 'name'>): ToolRun => ({
  toolCallId: partial.toolCallId ?? `${partial.name}-1`,
  status: partial.status ?? 'done',
  ...partial,
})

describe('formatTranscriptToolRun', () => {
  it('includes tool name, status, and args', () => {
    expect(
      formatTranscriptToolRun(
        run({
          name: 'read_file',
          args: { path: 'src/foo.ts' },
        }),
      ),
    ).toBe('TOOL read_file [done] {"path":"src/foo.ts"}')
  })

  it('omits args when they are missing or empty', () => {
    expect(formatTranscriptToolRun(run({ name: 'git_status' }))).toBe(
      'TOOL git_status [done]',
    )
    expect(formatTranscriptToolRun(run({ name: 'git_status', args: {} }))).toBe(
      'TOOL git_status [done]',
    )
  })

  it('appends the error message when status is error', () => {
    expect(
      formatTranscriptToolRun(
        run({
          name: 'grep',
          status: 'error',
          args: { pattern: 'TODO' },
          result: { error: 'File not found' },
        }),
      ),
    ).toBe('TOOL grep [error] {"pattern":"TODO"} File not found')
  })

  it('emits long args in full with no ellipsis', () => {
    const path = `src/${'a'.repeat(200)}.ts`
    const formatted = formatTranscriptToolRun(run({ name: 'read_file', args: { path } }))
    const expectedArgs = JSON.stringify({ path })
    expect(formatted).toBe(`TOOL read_file [done] ${expectedArgs}`)
    expect(formatted.includes('...')).toBe(false)
  })
})
