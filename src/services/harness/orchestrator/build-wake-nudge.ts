import type { SubagentResult } from '@/types/harness/subagent-record'

const REVIEW_GUIDANCE =
  'Review each returned subagent result critically. If you find slop, correctness issues, or incomplete work, call steer_subagent with rework instructions. Do not accept weak output or spawn a duplicate subagent.'

export default (
  completedResults: Array<{ toolCallId: string; result: SubagentResult }>,
  runningNames: string[],
  options?: { summariesInline?: boolean },
): string => {
  const lines = completedResults.map((item) => {
    const name = item.result.name.trim() || item.result.subagentId
    return `- ${name}: ${item.result.summary.trim()}`
  })
  const completedBlock = ['Completed:', ...lines]
  const summariesClause = options?.summariesInline
    ? 'Their completed summaries are included below.'
    : 'Their completed summaries are in the spawn_subagent tool results above.'

  if (runningNames.length === 0) {
    return [
      `Background subagent results are ready. ${summariesClause} Answer the user now using those results. Do not say the subagents are still running.`,
      REVIEW_GUIDANCE,
      '',
      ...completedBlock,
    ].join('\n')
  }

  const named = runningNames.join(', ')
  return [
    `A background subagent finished. Other background subagents are still running: ${named}. You may answer about the finished result now or wait for the rest. Your call.`,
    REVIEW_GUIDANCE,
    '',
    ...completedBlock,
  ].join('\n')
}
