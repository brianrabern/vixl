import type { AggregatedTurnFileChange } from '@/types/harness/file-checkpoint'

type RenameRef = Pick<AggregatedTurnFileChange, 'path' | 'operation' | 'renameTo'>

const resolveRenameTarget = (
  changes: ReadonlyArray<RenameRef>,
  startPath: string,
): string => {
  const renameByPath = new Map<string, string>()
  for (const change of changes) {
    if (
      change.operation === 'rename' &&
      change.renameTo !== undefined &&
      change.renameTo.length > 0
    ) {
      renameByPath.set(change.path, change.renameTo)
    }
  }

  const visited = new Set<string>()
  let current = startPath
  while (!visited.has(current)) {
    visited.add(current)
    const next = renameByPath.get(current)
    if (next === undefined || visited.has(next)) {
      return current
    }
    current = next
  }
  return current
}

export default resolveRenameTarget
