import { ref } from 'vue'
import type { Ref } from 'vue'
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'

export default () => {
  const items = ref<QueuedChatMessage[]>([]) as Ref<QueuedChatMessage[]>

  const peek = (): QueuedChatMessage | undefined => {
    return items.value[0]
  }

  const enqueue = (item: Omit<QueuedChatMessage, 'id'>): string => {
    const id = crypto.randomUUID()
    items.value = [...items.value, { ...item, id }]
    return id
  }

  const remove = (id: string): void => {
    items.value = items.value.filter((entry) => entry.id !== id)
  }

  const take = (): QueuedChatMessage | undefined => {
    const head = items.value[0]
    if (!head) {
      return undefined
    }
    items.value = items.value.slice(1)
    return head
  }

  const clear = (): void => {
    items.value = []
  }

  return {
    items,
    enqueue,
    remove,
    take,
    clear,
    peek,
  }
}
