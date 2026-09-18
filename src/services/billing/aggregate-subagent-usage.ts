import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'
import type { SubagentUsageAggregate } from '@/types/billing/subagent-usage-aggregate'

const recordHasTokens = (record: BillableUsageRecord): boolean => {
  const usage = record.usage
  return (
    (usage.inputTokens ?? 0) > 0 ||
    (usage.outputTokens ?? 0) > 0 ||
    (usage.cacheReadTokens ?? 0) > 0 ||
    (usage.cacheWriteTokens ?? 0) > 0 ||
    (usage.noCacheTokens ?? 0) > 0 ||
    (usage.reasoningTokens ?? 0) > 0 ||
    (usage.textTokens ?? 0) > 0 ||
    (usage.totalTokens ?? 0) > 0
  )
}

/**
 * Aggregate billable records for a single subagent (generate, steer, compaction).
 */
export default (
  records: BillableUsageRecord[],
  subagentId: string,
): SubagentUsageAggregate => {
  const parts = records.filter((record) => record.subagentId === subagentId)

  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let costSum = 0
  let hasPricedRecord = false
  let usageMissing = false

  for (const record of parts) {
    inputTokens += record.usage.inputTokens ?? 0
    outputTokens += record.usage.outputTokens ?? 0
    cacheReadTokens += record.usage.cacheReadTokens ?? 0
    cacheWriteTokens += record.usage.cacheWriteTokens ?? 0

    if (record.usageMissing) {
      usageMissing = true
    }

    if (record.costUSD !== null) {
      hasPricedRecord = true
      costSum += record.costUSD
    }
  }

  const tokenParts = parts.filter(recordHasTokens)
  const tokenCostsComplete = tokenParts.every(
    (record) => record.costUSD !== null,
  )

  // Sum known costs. Null only when nothing is priced (do not invent $0).
  const costUSD = hasPricedRecord ? costSum : null

  return {
    subagentId,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costUSD,
    pricingComplete: tokenCostsComplete,
    usageMissing,
    parts,
  }
}
