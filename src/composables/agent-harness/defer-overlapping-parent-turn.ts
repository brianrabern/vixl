import type { ChatStatus } from 'ai'
import type { Ref } from 'vue'

type DeferOverlappingParentTurnArgs = {
  resumeInFlight: boolean
  compacting: boolean
  enqueue: () => void
  abortController: Ref<AbortController | null>
  controller: AbortController
  previousAbort: AbortController | null
  status: Ref<ChatStatus>
}

export default (args: DeferOverlappingParentTurnArgs): boolean => {
  if (!args.resumeInFlight && !args.compacting) {
    return false
  }

  args.enqueue()
  if (!args.resumeInFlight) {
    args.status.value = 'ready'
  }
  if (args.abortController.value === args.controller) {
    args.abortController.value = args.previousAbort
  }
  return true
}
