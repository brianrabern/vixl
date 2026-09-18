import capToolOutput from '@/services/harness/subagent/cap-tool-output'
import { deriveToolDiffs } from '@/services/harness/orchestrator/helpers'
import type { FileDiff } from '@/types/harness/file-diff'

type NestedTool = {
  execute?: (...args: never[]) => unknown | Promise<unknown>
} & Record<string, unknown>

const DIFFS_REATTACH_CHAR_LIMIT = 32_000

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const diffsFitToReattach = (diffs: FileDiff[]): boolean => {
  try {
    const json = JSON.stringify(diffs)
    return typeof json === 'string' && json.length <= DIFFS_REATTACH_CHAR_LIMIT
  } catch {
    return false
  }
}

const capNestedToolOutput = (rawResult: unknown): unknown => {
  const diffs = deriveToolDiffs(rawResult)
  const capped = capToolOutput(rawResult)
  if (!diffs || !isPlainObject(capped) || Array.isArray(capped.diffs)) {
    return capped
  }
  if (!diffsFitToReattach(diffs)) {
    return capped
  }
  return { ...capped, diffs }
}

const wrapNestedTools = (
  tools: Record<string, NestedTool>,
): Record<string, NestedTool> => {
  const wrapped: Record<string, NestedTool> = {}
  for (const [name, toolDef] of Object.entries(tools)) {
    const { execute } = toolDef
    if (typeof execute !== 'function') {
      wrapped[name] = toolDef
      continue
    }
    wrapped[name] = {
      ...toolDef,
      execute: async (...args: never[]) =>
        capNestedToolOutput(await execute(...args)),
    }
  }
  return wrapped
}

export default wrapNestedTools
