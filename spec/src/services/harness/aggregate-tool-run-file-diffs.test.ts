import { describe, expect, it } from 'vitest'
import aggregateToolRunFileDiffs from '@/services/harness/aggregate-tool-run-file-diffs'
import type { AggregatedTurnFileChange } from '@/types/harness/file-checkpoint'
import type { FileDiff, FileDiffOperation } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'

const diff = (
  path: string,
  operation: FileDiffOperation,
  additions: number,
  deletions: number,
): FileDiff => ({
  path,
  operation,
  hunks: [
    {
      oldStart: 1,
      newStart: 1,
      lines: [
        ...Array.from({ length: deletions }, () => ({
          kind: 'remove' as const,
          content: 'old',
        })),
        ...Array.from({ length: additions }, () => ({
          kind: 'add' as const,
          content: 'new',
        })),
      ],
    },
  ],
})

const run = (
  partial: Partial<ToolRun> & Pick<ToolRun, 'toolCallId' | 'status'>,
): ToolRun => ({
  name: 'edit_file',
  ...partial,
})

describe('aggregateToolRunFileDiffs', () => {
  it('only counts done runs that have diffs', () => {
    const changes = aggregateToolRunFileDiffs([
      run({
        toolCallId: 'running',
        status: 'running',
        diffs: [diff('a.ts', 'update', 1, 0)],
      }),
      run({
        toolCallId: 'error',
        status: 'error',
        diffs: [diff('b.ts', 'update', 1, 0)],
      }),
      run({
        toolCallId: 'rejected',
        status: 'rejected',
        diffs: [diff('c.ts', 'update', 1, 0)],
      }),
      run({
        toolCallId: 'done-empty',
        status: 'done',
        diffs: [],
      }),
      run({
        toolCallId: 'done-missing',
        status: 'done',
      }),
      run({
        toolCallId: 'done',
        status: 'done',
        diffs: [diff('z.ts', 'create', 2, 0)],
      }),
    ])

    expect(changes).toEqual([
      { path: 'z.ts', operation: 'create', additions: 2, deletions: 0 },
    ])
  })

  it('merges by path with operation priority and summed line counts', () => {
    const changes = aggregateToolRunFileDiffs([
      run({
        toolCallId: 't1',
        status: 'done',
        diffs: [
          diff('b.ts', 'update', 1, 1),
          diff('a.ts', 'create', 2, 0),
        ],
      }),
      run({
        toolCallId: 't2',
        status: 'done',
        diffs: [
          diff('a.ts', 'update', 1, 1),
          diff('a.ts', 'delete', 0, 3),
        ],
      }),
    ])

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'delete', additions: 3, deletions: 4 },
      { path: 'b.ts', operation: 'update', additions: 1, deletions: 1 },
    ])
  })

  it('does not downgrade a higher-priority operation', () => {
    const changes = aggregateToolRunFileDiffs([
      run({
        toolCallId: 't1',
        status: 'done',
        diffs: [diff('a.ts', 'delete', 0, 1)],
      }),
      run({
        toolCallId: 't2',
        status: 'done',
        diffs: [diff('a.ts', 'create', 2, 0)],
      }),
    ])

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'delete', additions: 2, deletions: 1 },
    ])
  })

  it('folds new diffs into an existing aggregated list', () => {
    const existing: AggregatedTurnFileChange[] = [
      { path: 'a.ts', operation: 'create', additions: 2, deletions: 0 },
      { path: 'c.ts', operation: 'update', additions: 1, deletions: 1 },
    ]

    const changes = aggregateToolRunFileDiffs(
      [
        run({
          toolCallId: 't1',
          status: 'done',
          diffs: [diff('a.ts', 'update', 1, 1), diff('b.ts', 'rename', 0, 0)],
        }),
      ],
      existing,
    )

    expect(changes).toEqual([
      { path: 'a.ts', operation: 'update', additions: 3, deletions: 1 },
      { path: 'b.ts', operation: 'rename', additions: 0, deletions: 0 },
      { path: 'c.ts', operation: 'update', additions: 1, deletions: 1 },
    ])
  })

  it('keeps rename destination from newContent as renameTo', () => {
    const changes = aggregateToolRunFileDiffs([
      run({
        toolCallId: 'move',
        status: 'done',
        diffs: [
          {
            ...diff('old.ts', 'rename', 1, 1),
            newContent: 'new.ts',
          },
        ],
      }),
    ])

    expect(changes).toEqual([
      {
        path: 'old.ts',
        operation: 'rename',
        additions: 1,
        deletions: 1,
        renameTo: 'new.ts',
      },
    ])
  })

  it('keeps the latest non-undefined renameTo when merging the same path', () => {
    const existing: AggregatedTurnFileChange[] = [
      {
        path: 'old.ts',
        operation: 'rename',
        additions: 0,
        deletions: 0,
        renameTo: 'mid.ts',
      },
    ]

    const changes = aggregateToolRunFileDiffs(
      [
        run({
          toolCallId: 'later',
          status: 'done',
          diffs: [
            {
              ...diff('old.ts', 'rename', 1, 0),
              newContent: 'final.ts',
            },
          ],
        }),
      ],
      existing,
    )

    expect(changes).toEqual([
      {
        path: 'old.ts',
        operation: 'rename',
        additions: 1,
        deletions: 0,
        renameTo: 'final.ts',
      },
    ])
  })

  it('drops renameTo when a later delete for the same path upgrades the operation', () => {
    const existing: AggregatedTurnFileChange[] = [
      {
        path: 'old.ts',
        operation: 'rename',
        additions: 1,
        deletions: 1,
        renameTo: 'new.ts',
      },
    ]

    const changes = aggregateToolRunFileDiffs(
      [
        run({
          toolCallId: 'remove',
          status: 'done',
          diffs: [diff('old.ts', 'delete', 0, 2)],
        }),
      ],
      existing,
    )

    expect(changes).toEqual([
      { path: 'old.ts', operation: 'delete', additions: 1, deletions: 3 },
    ])
  })

  it('drops incoming renameTo when an existing delete keeps priority', () => {
    const existing: AggregatedTurnFileChange[] = [
      { path: 'old.ts', operation: 'delete', additions: 0, deletions: 1 },
    ]

    const changes = aggregateToolRunFileDiffs(
      [
        run({
          toolCallId: 'move',
          status: 'done',
          diffs: [
            {
              ...diff('old.ts', 'rename', 1, 0),
              newContent: 'new.ts',
            },
          ],
        }),
      ],
      existing,
    )

    expect(changes).toEqual([
      { path: 'old.ts', operation: 'delete', additions: 1, deletions: 1 },
    ])
  })

  it('preserves renameTo when a later merge for the same path omits it', () => {
    const existing: AggregatedTurnFileChange[] = [
      {
        path: 'old.ts',
        operation: 'rename',
        additions: 0,
        deletions: 0,
        renameTo: 'new.ts',
      },
    ]

    const changes = aggregateToolRunFileDiffs(
      [
        run({
          toolCallId: 'edit',
          status: 'done',
          diffs: [diff('old.ts', 'update', 1, 0)],
        }),
      ],
      existing,
    )

    expect(changes).toEqual([
      {
        path: 'old.ts',
        operation: 'rename',
        additions: 1,
        deletions: 0,
        renameTo: 'new.ts',
      },
    ])
  })
})
