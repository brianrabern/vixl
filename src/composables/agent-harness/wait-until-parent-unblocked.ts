import type { AgentHarnessState } from './types'

export default (state: AgentHarnessState): Promise<void> => {
  const isBlocked = (): boolean =>
    state.compacting.value || state.resumingBackgroundBatch.value

  if (state.disposed.value || !isBlocked()) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const stopWatch = watch(
      [state.compacting, state.resumingBackgroundBatch, state.disposed],
      () => {
        if (state.disposed.value || !isBlocked()) {
          stopWatch()
          resolve()
        }
      },
    )
  })
}
