import { describe, expect, it } from 'vitest'
import useMessageQueue from '@/composables/use-message-queue'

describe('useMessageQueue', () => {
  it('enqueues more than the former cap of ten messages', () => {
    const queue = useMessageQueue()

    for (let index = 0; index < 12; index += 1) {
      queue.enqueue({
        text: `item-${index}`,
        files: [],
        mode: 'agent',
        model: 'openai::gpt-4o',
      })
    }

    expect(queue.items.value).toHaveLength(12)
    expect(queue.peek()?.text).toBe('item-0')
  })

  it('preserves skipUserMessage on queued items', () => {
    const queue = useMessageQueue()

    queue.enqueue({
      text: 'already-persisted',
      files: [],
      mode: 'agent',
      model: 'openai::gpt-4o',
      skipUserMessage: true,
    })

    expect(queue.take()?.skipUserMessage).toBe(true)
  })

  it('preserves skipUserPersist on queued items', () => {
    const queue = useMessageQueue()

    queue.enqueue({
      text: 'already-persisted',
      files: [],
      mode: 'agent',
      model: 'openai::gpt-4o',
      skipUserMessage: true,
      skipUserPersist: true,
    })

    expect(queue.take()?.skipUserPersist).toBe(true)
  })

  it('preserves appendedUserMessageId on queued items', () => {
    const queue = useMessageQueue()

    queue.enqueue({
      text: '',
      files: [],
      mode: 'agent',
      model: 'openai::gpt-4o',
      skipUserMessage: true,
      skipUserPersist: true,
      appendedUserMessageId: 'user-msg-1',
    })

    expect(queue.take()?.appendedUserMessageId).toBe('user-msg-1')
  })
})
