import { describe, expect, it } from 'vitest'
import applySubagentToolEvent from '@/utils/apply-subagent-tool-event'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'

const diffs: FileDiff[] = [
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

describe('applySubagentToolEvent', () => {
  it('copies diffs from a tool-result event onto the ToolRun', () => {
    const tools: ToolRun[] = [
      {
        toolCallId: 't1',
        name: 'edit_file',
        status: 'running',
        args: { path: 'src/a.ts' },
      },
    ]

    const next = applySubagentToolEvent(tools, {
      type: 'tool-result',
      toolCallId: 't1',
      result: { ok: true, diffs },
      diffs,
    })

    expect(next).toHaveLength(1)
    expect(next[0]).toEqual({
      toolCallId: 't1',
      name: 'edit_file',
      status: 'done',
      args: { path: 'src/a.ts' },
      result: { ok: true, diffs },
      artifact: undefined,
      diffs,
    })
  })
})
