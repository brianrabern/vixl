import { describe, expect, it } from 'vitest'
import aggregatesBySubagentId from '@/services/billing/aggregates-by-subagent-id'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'

const baseRecord = (
  patch: Partial<BillableUsageRecord> &
    Pick<BillableUsageRecord, 'id' | 'source' | 'costUSD' | 'pricingSource'>,
): BillableUsageRecord => ({
  chatId: 'chat-1',
  turnId: 'turn-1',
  at: '2026-01-01T00:00:00.000Z',
  providerId: 'openai',
  modelId: 'gpt-4o',
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  ...patch,
})

describe('aggregatesBySubagentId', () => {
  it('groups matching records and excludes missing or other subagentIds', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: 0.01,
        pricingSource: 'user_configured',
      }),
      baseRecord({
        id: 'b',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: 0.02,
        pricingSource: 'user_configured',
        usage: {
          inputTokens: 40,
          outputTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      }),
      baseRecord({
        id: 'c',
        source: 'subagent',
        subagentId: 'sub-2',
        costUSD: 0.05,
        pricingSource: 'user_configured',
        usage: {
          inputTokens: 7,
          outputTokens: 3,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      }),
      baseRecord({
        id: 'd',
        source: 'main',
        costUSD: 1,
        pricingSource: 'user_configured',
      }),
    ]

    const byId = aggregatesBySubagentId(records)
    expect(Object.keys(byId).sort()).toEqual(['sub-1', 'sub-2'])
    expect(byId['sub-1']?.inputTokens).toBe(140)
    expect(byId['sub-1']?.outputTokens).toBe(60)
    expect(byId['sub-1']?.costUSD).toBeCloseTo(0.03)
    expect(byId['sub-1']?.parts.map((part) => part.id)).toEqual(['a', 'b'])
    expect(byId['sub-2']?.inputTokens).toBe(7)
    expect(byId['sub-2']?.costUSD).toBeCloseTo(0.05)
    expect(byId['sub-2']?.parts.map((part) => part.id)).toEqual(['c'])
  })
})
