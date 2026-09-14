const steerInbox = new Map<string, string[]>()

export const pushSteer = (subagentId: string, message: string): void => {
  const queue = steerInbox.get(subagentId) ?? []
  queue.push(message)
  steerInbox.set(subagentId, queue)
}

export const drainSteers = (subagentId: string): string[] => {
  const queued = steerInbox.get(subagentId) ?? []
  steerInbox.delete(subagentId)
  return queued
}

export const clearSteers = (subagentId: string): void => {
  steerInbox.delete(subagentId)
}

export const resetInboxForTests = (): void => {
  steerInbox.clear()
}
