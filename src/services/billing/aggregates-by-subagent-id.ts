import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'
import type { SubagentUsageAggregate } from '@/types/billing/subagent-usage-aggregate'
import aggregateSubagentUsage from '@/services/billing/aggregate-subagent-usage'

export default (
  records: BillableUsageRecord[],
): Record<string, SubagentUsageAggregate> => {
  const bySubagent: Record<string, SubagentUsageAggregate> = {}
  const subagentIds = new Set<string>()
  for (const record of records) {
    if (record.subagentId) {
      subagentIds.add(record.subagentId)
    }
  }
  for (const subagentId of subagentIds) {
    bySubagent[subagentId] = aggregateSubagentUsage(records, subagentId)
  }
  return bySubagent
}
