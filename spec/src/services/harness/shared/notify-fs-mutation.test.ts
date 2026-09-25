import { beforeEach, describe, expect, it } from 'vitest'
import {
  notifyWorkspaceFsMutation,
  queuedWorkspaceFsMutationCount,
  resetWorkspaceFsMutationsForTests,
  subscribeWorkspaceFsMutations,
  workspaceFsMutationNotice,
} from '@/services/harness/shared/notify-fs-mutation'

describe('notifyWorkspaceFsMutation', () => {
  beforeEach(() => {
    resetWorkspaceFsMutationsForTests()
  })

  it('includes every ancestor of a nested create up to the root', () => {
    const subscriber = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['lib/utils/helper.ts'])

    expect(workspaceFsMutationNotice.value?.payload).toEqual({
      rootPath: '/project',
      directories: ['lib/utils', 'lib', '.'],
      rescan: false,
    })
    expect(subscriber.takePending()).toEqual([
      {
        rootPath: '/project',
        directories: ['lib/utils', 'lib', '.'],
        rescan: false,
      },
    ])
  })

  it('uses the root directory for a top-level path', () => {
    notifyWorkspaceFsMutation('/project', ['bar.txt'])

    expect(workspaceFsMutationNotice.value?.payload).toEqual({
      rootPath: '/project',
      directories: ['.'],
      rescan: false,
    })
  })

  it('dedupes shared ancestors across multiple paths', () => {
    notifyWorkspaceFsMutation('/project', ['lib/utils/a.ts', 'lib/utils/b.ts', 'lib/other.ts'])

    expect(workspaceFsMutationNotice.value?.payload).toEqual({
      rootPath: '/project',
      directories: ['lib/utils', 'lib', '.'],
      rescan: false,
    })
  })

  it('keeps a deterministic deepest-first order for mixed paths', () => {
    notifyWorkspaceFsMutation('/project', ['src/lib/a.ts', 'docs/readme.md'])

    expect(workspaceFsMutationNotice.value?.payload.directories).toEqual([
      'src/lib',
      'src',
      '.',
      'docs',
    ])
    notifyWorkspaceFsMutation('/project', ['src/lib/a.ts', 'docs/readme.md'])
    expect(workspaceFsMutationNotice.value?.payload.directories).toEqual([
      'src/lib',
      'src',
      '.',
      'docs',
    ])
  })

  it('increments the nonce so identical payloads still notify', () => {
    notifyWorkspaceFsMutation('/project', ['src/a.ts'])
    const firstNonce = workspaceFsMutationNotice.value?.nonce
    notifyWorkspaceFsMutation('/project', ['src/a.ts'])

    expect(firstNonce).toBe(1)
    expect(workspaceFsMutationNotice.value?.nonce).toBe(2)
    expect(workspaceFsMutationNotice.value?.payload.directories).toEqual(['src', '.'])
  })

  it('queues every payload from same-tick notifications', () => {
    const subscriber = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['src/a.ts'])
    notifyWorkspaceFsMutation('/project', ['lib/b.ts'])

    expect(subscriber.takePending()).toEqual([
      {
        rootPath: '/project',
        directories: ['src', '.'],
        rescan: false,
      },
      {
        rootPath: '/project',
        directories: ['lib', '.'],
        rescan: false,
      },
    ])
    expect(subscriber.takePending()).toEqual([])
  })

  it('emits forward-slash ancestors for backslash nested paths', () => {
    const subscriber = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['src\\lib\\helper.ts'])

    expect(workspaceFsMutationNotice.value?.payload).toEqual({
      rootPath: '/project',
      directories: ['src/lib', 'src', '.'],
      rescan: false,
    })
    expect(subscriber.takePending()).toEqual([
      {
        rootPath: '/project',
        directories: ['src/lib', 'src', '.'],
        rescan: false,
      },
    ])
  })

  it('normalizes mixed separators before computing ancestors', () => {
    notifyWorkspaceFsMutation('/project', ['src\\utils/helper.ts'])

    expect(workspaceFsMutationNotice.value?.payload.directories).toEqual(['src/utils', 'src', '.'])
  })

  it('delivers every later payload to each independent subscriber', () => {
    const first = subscribeWorkspaceFsMutations()
    const second = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['src/a.ts'])
    notifyWorkspaceFsMutation('/other', ['lib/b.ts'])

    const expected = [
      {
        rootPath: '/project',
        directories: ['src', '.'],
        rescan: false,
      },
      {
        rootPath: '/other',
        directories: ['lib', '.'],
        rescan: false,
      },
    ]
    expect(first.takePending()).toEqual(expected)
    expect(second.takePending()).toEqual(expected)
    expect(first.takePending()).toEqual([])
    expect(second.takePending()).toEqual([])
  })

  it('does not replay payloads published before a subscriber mounts', () => {
    const early = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['src/old.ts'])
    const late = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['lib/new.ts'])

    expect(late.takePending()).toEqual([
      {
        rootPath: '/project',
        directories: ['lib', '.'],
        rescan: false,
      },
    ])
    expect(early.takePending()).toEqual([
      {
        rootPath: '/project',
        directories: ['src', '.'],
        rescan: false,
      },
      {
        rootPath: '/project',
        directories: ['lib', '.'],
        rescan: false,
      },
    ])
  })

  it('stops delivery and compacts queued entries after dispose', () => {
    const kept = subscribeWorkspaceFsMutations()
    const dropped = subscribeWorkspaceFsMutations()
    notifyWorkspaceFsMutation('/project', ['src/a.ts'])
    notifyWorkspaceFsMutation('/project', ['lib/b.ts'])
    expect(queuedWorkspaceFsMutationCount()).toBe(2)

    dropped.dispose()
    expect(queuedWorkspaceFsMutationCount()).toBe(2)
    expect(dropped.takePending()).toEqual([])

    expect(kept.takePending()).toEqual([
      {
        rootPath: '/project',
        directories: ['src', '.'],
        rescan: false,
      },
      {
        rootPath: '/project',
        directories: ['lib', '.'],
        rescan: false,
      },
    ])
    expect(queuedWorkspaceFsMutationCount()).toBe(0)

    notifyWorkspaceFsMutation('/project', ['docs/c.ts'])
    kept.dispose()
    expect(queuedWorkspaceFsMutationCount()).toBe(0)
    expect(kept.takePending()).toEqual([])
  })
})
