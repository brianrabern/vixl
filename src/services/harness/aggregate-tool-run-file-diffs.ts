import countDiffLines from '@/utils/count-diff-lines'
import resolveFileDiffHunks from '@/utils/resolve-file-diff-hunks'
import type { AggregatedTurnFileChange } from '@/types/harness/file-checkpoint'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'

const operationPriority: Record<AggregatedTurnFileChange['operation'], number> = {
  create: 0,
  update: 1,
  rename: 2,
  delete: 3,
}

const mergeChange = (
  byPath: Map<string, AggregatedTurnFileChange>,
  change: AggregatedTurnFileChange,
): void => {
  const existing = byPath.get(change.path)
  if (!existing) {
    byPath.set(change.path, { ...change })
    return
  }
  existing.additions += change.additions
  existing.deletions += change.deletions
  if (operationPriority[change.operation] > operationPriority[existing.operation]) {
    existing.operation = change.operation
  }
}

const mergeDiff = (
  byPath: Map<string, AggregatedTurnFileChange>,
  diff: FileDiff,
): void => {
  const counts = countDiffLines(resolveFileDiffHunks(diff))
  mergeChange(byPath, {
    path: diff.path,
    operation: diff.operation,
    additions: counts.additions,
    deletions: counts.deletions,
  })
}

const aggregateToolRunFileDiffs = (
  tools: ToolRun[],
  existing: AggregatedTurnFileChange[] = [],
): AggregatedTurnFileChange[] => {
  const byPath = new Map<string, AggregatedTurnFileChange>()
  for (const change of existing) {
    mergeChange(byPath, change)
  }
  for (const tool of tools) {
    if (tool.status !== 'done' || !tool.diffs?.length) {
      continue
    }
    for (const diff of tool.diffs) {
      mergeDiff(byPath, diff)
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export default aggregateToolRunFileDiffs
