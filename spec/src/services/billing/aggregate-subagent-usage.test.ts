import { describe, expect, it } from 'vitest'
import aggregateSubagentUsage from '@/services/billing/aggregate-subagent-usage'
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
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
  },
  ...patch,
})

describe('aggregateSubagentUsage', () => {
  it('sums tokens and cost for records with the same subagentId', () => {
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
          inputTokens: 200,
          outputTokens: 25,
          cacheReadTokens: 4,
          cacheWriteTokens: 1,
        },
      }),
      baseRecord({
        id: 'c',
        source: 'subagent',
        subagentId: 'sub-2',
        costUSD: 9,
        pricingSource: 'user_configured',
      }),
      baseRecord({
        id: 'd',
        source: 'main',
        costUSD: 3,
        pricingSource: 'user_configured',
      }),
    ]

    const aggregate = aggregateSubagentUsage(records, 'sub-1')
    expect(aggregate.subagentId).toBe('sub-1')
    expect(aggregate.inputTokens).toBe(300)
    expect(aggregate.outputTokens).toBe(75)
    expect(aggregate.cacheReadTokens).toBe(14)
    expect(aggregate.cacheWriteTokens).toBe(6)
    expect(aggregate.costUSD).toBeCloseTo(0.03)
    expect(aggregate.pricingComplete).toBe(true)
    expect(aggregate.usageMissing).toBe(false)
    expect(aggregate.parts.map((part) => part.id)).toEqual(['a', 'b'])
  })

  it('returns null cost when no record is priced', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: null,
        pricingSource: 'none',
      }),
    ]

    const aggregate = aggregateSubagentUsage(records, 'sub-1')
    expect(aggregate.costUSD).toBeNull()
    expect(aggregate.pricingComplete).toBe(false)
  })

  it('marks pricing incomplete when a token-bearing record has null costUSD', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: 0.0072,
        pricingSource: 'provider_reported',
      }),
      baseRecord({
        id: 'b',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: null,
        pricingSource: 'none',
        usage: {
          inputTokens: 126,
          outputTokens: 4,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      }),
    ]

    const aggregate = aggregateSubagentUsage(records, 'sub-1')
    expect(aggregate.costUSD).toBeCloseTo(0.0072)
    expect(aggregate.pricingComplete).toBe(false)
  })

  it('propagates usageMissing from any matching part', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: null,
        pricingSource: 'none',
        usageMissing: true,
        usage: {},
      }),
      baseRecord({
        id: 'b',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: 0.01,
        pricingSource: 'user_configured',
      }),
    ]

    const aggregate = aggregateSubagentUsage(records, 'sub-1')
    expect(aggregate.usageMissing).toBe(true)
    expect(aggregate.pricingComplete).toBe(true)
    expect(aggregate.costUSD).toBeCloseTo(0.01)
  })
})
