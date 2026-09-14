import type { MaybeRefOrGetter } from 'vue'
import type { ChatStackId } from '@/types/chat/chat-stack-id'

type ChatStackPillsOptions = {
  subagents: MaybeRefOrGetter<number>
  approvals: MaybeRefOrGetter<number>
  terminals: MaybeRefOrGetter<number>
  queue: MaybeRefOrGetter<number>
  todos: MaybeRefOrGetter<number>
  resetKey: MaybeRefOrGetter<string>
}

const STACK_IDS: ChatStackId[] = [
  'subagents',
  'approvals',
  'terminals',
  'queue',
  'todos',
]

const readCount = (
  sources: ChatStackPillsOptions,
  id: ChatStackId,
): number => toValue(sources[id])

export default (options: ChatStackPillsOptions) => {
  const openStack = ref<ChatStackId | null>(null)
  const order = ref<ChatStackId[]>([])

  const visiblePills = computed((): ChatStackId[] =>
    order.value.filter((id) => readCount(options, id) > 0),
  )

  const toggleStack = (id: ChatStackId): void => {
    openStack.value = openStack.value === id ? null : id
  }

  const initializeFromCounts = (): void => {
    order.value = STACK_IDS.filter((id) => readCount(options, id) > 0)
    openStack.value = toValue(options.approvals) > 0 ? 'approvals' : null
  }

  initializeFromCounts()

  watch(
    [
      () => toValue(options.subagents),
      () => toValue(options.approvals),
      () => toValue(options.terminals),
      () => toValue(options.queue),
      () => toValue(options.todos),
    ],
    (next, prev) => {
      const nextById: Record<ChatStackId, number> = {
        subagents: next[0] ?? 0,
        approvals: next[1] ?? 0,
        terminals: next[2] ?? 0,
        queue: next[3] ?? 0,
        todos: next[4] ?? 0,
      }
      const prevById: Record<ChatStackId, number> = {
        subagents: prev[0] ?? 0,
        approvals: prev[1] ?? 0,
        terminals: prev[2] ?? 0,
        queue: prev[3] ?? 0,
        todos: prev[4] ?? 0,
      }

      let nextOrder = [...order.value]

      for (const id of STACK_IDS) {
        const nextCount = nextById[id]
        const prevCount = prevById[id]

        if (prevCount <= 0 && nextCount > 0) {
          nextOrder = [...nextOrder.filter((entry) => entry !== id), id]
        } else if (nextCount <= 0) {
          nextOrder = nextOrder.filter((entry) => entry !== id)
        }
      }

      order.value = nextOrder

      const current = openStack.value
      if (current !== null && nextById[current] <= 0) {
        openStack.value = null
      }
    },
  )

  watch(
    () => toValue(options.approvals),
    (next, prev) => {
      if (next > prev) {
        openStack.value = 'approvals'
      }
    },
  )

  watch(
    () => toValue(options.resetKey),
    () => {
      initializeFromCounts()
    },
  )

  return {
    visiblePills,
    openStack,
    toggleStack,
  }
}
