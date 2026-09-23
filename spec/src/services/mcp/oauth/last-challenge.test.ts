import { beforeEach, describe, expect, it } from 'vitest'
import {
  getLastOAuthChallenge,
  recordLastOAuthChallenge,
  resetLastOAuthChallengesForTests,
} from '@/services/mcp/oauth/last-challenge'

describe('getLastOAuthChallenge', () => {
  beforeEach(() => {
    resetLastOAuthChallengesForTests()
  })

  it('returns undefined for a templated url instead of throwing', () => {
    recordLastOAuthChallenge('https://mcp.example/mcp', {
      scope: 'mcp:tools',
    })

    expect(() =>
      getLastOAuthChallenge('https://${env:HOST}/mcp'),
    ).not.toThrow()
    expect(getLastOAuthChallenge('https://${env:HOST}/mcp')).toBeUndefined()
    expect(getLastOAuthChallenge('https://mcp.example/mcp')?.scope).toBe(
      'mcp:tools',
    )
  })
})
