import { describe, expect, it } from 'vitest'
import { UnauthorizedError } from '@ai-sdk/mcp'
import { mcpAuthKindForError } from '@/services/harness/mcp/auth'

describe('mcpAuthKindForError', () => {
  it('returns inputs for headers mode on a plain 401', () => {
    expect(mcpAuthKindForError(new Error('401'), 'headers')).toBe('inputs')
  })

  it('returns inputs for headers mode on UnauthorizedError', () => {
    expect(mcpAuthKindForError(new UnauthorizedError(), 'headers')).toBe('inputs')
  })

  it('keeps oauth kind for oauth mode on a plain 401', () => {
    expect(mcpAuthKindForError(new Error('401'), 'oauth')).toBe('oauth')
  })

  it('keeps existing oauth kind when authMode is undefined', () => {
    expect(mcpAuthKindForError(new Error('unauthorized'))).toBe('oauth')
    expect(mcpAuthKindForError(new UnauthorizedError())).toBe('oauth')
    expect(mcpAuthKindForError(new Error('auth_required:inputs'))).toBe('inputs')
    expect(
      mcpAuthKindForError(new Error('does not support dynamic client registration')),
    ).toBe('client')
  })

  it('keeps oauth kind for none mode as the upgrade offer path', () => {
    expect(mcpAuthKindForError(new Error('401'), 'none')).toBe('oauth')
    expect(mcpAuthKindForError(new UnauthorizedError(), 'none')).toBe('oauth')
  })
})
