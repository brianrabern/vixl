import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatTurnFilesChanged from '@/components/chat/ChatTurnFilesChanged.vue'
import type { AggregatedTurnFileChange } from '@/types/harness/file-checkpoint'

const passThrough = { template: '<div><slot /></div>' }

const stubs = {
  AlertDialog: passThrough,
  AlertDialogContent: passThrough,
  AlertDialogHeader: passThrough,
  AlertDialogTitle: passThrough,
  AlertDialogDescription: passThrough,
  AlertDialogFooter: passThrough,
  AlertDialogCancel: { template: '<button><slot /></button>' },
  Tooltip: passThrough,
  TooltipTrigger: passThrough,
  TooltipContent: true,
  Collapsible: passThrough,
  CollapsibleTrigger: { template: '<button><slot /></button>' },
  CollapsibleContent: passThrough,
  CommitFiles: passThrough,
  CommitFile: passThrough,
  CommitFileStatus: true,
  CommitFilePath: { template: '<span><slot /></span>' },
  CommitFileAdditions: true,
  CommitFileDeletions: true,
}

const cumulativeChanges: AggregatedTurnFileChange[] = [
  { path: 'a.ts', operation: 'update', additions: 2, deletions: 1 },
  { path: 'b.ts', operation: 'create', additions: 3, deletions: 0 },
]

const perTurnChanges: AggregatedTurnFileChange[] = [
  { path: 'a.ts', operation: 'update', additions: 2, deletions: 1 },
]

const clarification =
  'Only files changed since that message are reverted. Earlier changes listed above are kept.'

const latestMessageWarning = 'Your latest message will also be discarded.'

let wrapper: VueWrapper | null = null

const mountBlock = (props: {
  changes?: AggregatedTurnFileChange[]
  restoreChanges?: AggregatedTurnFileChange[]
  restoreEnabled?: boolean
  restoreDiscardsLatestMessage?: boolean
}): VueWrapper => {
  wrapper = mount(ChatTurnFilesChanged, {
    props: {
      changes: props.changes ?? cumulativeChanges,
      restoreChanges: props.restoreChanges,
      restoreEnabled: props.restoreEnabled ?? true,
      restoreDiscardsLatestMessage: props.restoreDiscardsLatestMessage,
    },
    global: { stubs },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ChatTurnFilesChanged restore dialog copy', () => {
  it('clarifies that only files since the prompting message are reverted when restoreChanges is narrower', () => {
    const mounted = mountBlock({ restoreChanges: perTurnChanges })
    expect(mounted.text()).toContain('Revert files from this turn?')
    expect(mounted.text()).toContain(clarification)
    expect(mounted.text()).toContain('This will revert 1 file')
    expect(mounted.text()).toContain(
      'to the state before the message that prompted this turn',
    )
    expect(mounted.text()).toContain(
      'and discard the conversation after that message.',
    )
    expect(mounted.text()).toContain(
      'Manual edits on those paths will also be overwritten.',
    )
    expect(mounted.text()).not.toContain(latestMessageWarning)
  })

  it('keeps the original copy when restoreChanges is omitted', () => {
    const mounted = mountBlock({})
    expect(mounted.text()).toContain('Revert files from this turn?')
    expect(mounted.text()).not.toContain(clarification)
    expect(mounted.text()).toContain('This will revert 2 files')
    expect(mounted.text()).toContain(
      'to the state before the message that prompted this turn',
    )
    expect(mounted.text()).toContain('(1 created file removed)')
    expect(mounted.text()).toContain(
      'and discard the conversation after that message.',
    )
    expect(mounted.text()).toContain(
      'Manual edits on those paths will also be overwritten.',
    )
    expect(mounted.text()).not.toContain(latestMessageWarning)
  })

  it('keeps the original copy when restoreChanges covers the same paths', () => {
    const mounted = mountBlock({ restoreChanges: cumulativeChanges })
    expect(mounted.text()).toContain('Revert files from this turn?')
    expect(mounted.text()).not.toContain(clarification)
    expect(mounted.text()).toContain('This will revert 2 files')
    expect(mounted.text()).toContain(
      'to the state before the message that prompted this turn',
    )
    expect(mounted.text()).toContain('(1 created file removed)')
    expect(mounted.text()).toContain(
      'and discard the conversation after that message.',
    )
    expect(mounted.text()).toContain(
      'Manual edits on those paths will also be overwritten.',
    )
    expect(mounted.text()).not.toContain(latestMessageWarning)
  })

  it('warns that the latest message is discarded when restoreDiscardsLatestMessage is true', () => {
    const mounted = mountBlock({ restoreDiscardsLatestMessage: true })
    expect(mounted.text()).toContain(latestMessageWarning)
  })

  it('omits the latest-message warning when restoreDiscardsLatestMessage is false', () => {
    const mounted = mountBlock({ restoreDiscardsLatestMessage: false })
    expect(mounted.text()).not.toContain(latestMessageWarning)
  })
})
