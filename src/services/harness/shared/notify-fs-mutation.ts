import { ref } from 'vue'
import type { WorkspaceTreeChanged } from '@/composables/file-tree-view/merge-directory-children'

export type WorkspaceFsMutationNotice = {
  payload: WorkspaceTreeChanged
  nonce: number
}

export type WorkspaceFsMutationSubscription = {
  takePending: () => WorkspaceTreeChanged[]
  dispose: () => void
}

type QueuedWorkspaceFsMutation = {
  seq: number
  payload: WorkspaceTreeChanged
}

export const workspaceFsMutationNotice = ref<WorkspaceFsMutationNotice | null>(null)

const queuedWorkspaceFsMutations: QueuedWorkspaceFsMutation[] = []
const consumerCursors = new Map<number, number>()
let nextSeq = 1
let nextConsumerId = 1

const ancestorDirectories = (workspacePath: string): string[] => {
  const normalized = workspacePath.replace(/\\/g, '/')
  if (!normalized.includes('/')) {
    return ['.']
  }
  const segments = normalized.split('/')
  const directories: string[] = []
  for (let depth = segments.length - 1; depth >= 1; depth -= 1) {
    directories.push(segments.slice(0, depth).join('/'))
  }
  directories.push('.')
  return directories
}

const compactQueuedWorkspaceFsMutations = (): void => {
  if (consumerCursors.size === 0) {
    queuedWorkspaceFsMutations.length = 0
    return
  }
  let minCursor = Number.POSITIVE_INFINITY
  for (const cursor of consumerCursors.values()) {
    if (cursor < minCursor) {
      minCursor = cursor
    }
  }
  const firstKeep = queuedWorkspaceFsMutations.findIndex((entry) => entry.seq >= minCursor)
  if (firstKeep === -1) {
    queuedWorkspaceFsMutations.length = 0
    return
  }
  if (firstKeep > 0) {
    queuedWorkspaceFsMutations.splice(0, firstKeep)
  }
}

export const subscribeWorkspaceFsMutations = (): WorkspaceFsMutationSubscription => {
  const id = nextConsumerId
  nextConsumerId += 1
  consumerCursors.set(id, nextSeq)
  return {
    takePending: (): WorkspaceTreeChanged[] => {
      const cursor = consumerCursors.get(id)
      if (cursor === undefined) {
        return []
      }
      const pending: WorkspaceTreeChanged[] = []
      for (const entry of queuedWorkspaceFsMutations) {
        if (entry.seq >= cursor) {
          pending.push(entry.payload)
        }
      }
      consumerCursors.set(id, nextSeq)
      compactQueuedWorkspaceFsMutations()
      return pending
    },
    dispose: (): void => {
      if (!consumerCursors.delete(id)) {
        return
      }
      compactQueuedWorkspaceFsMutations()
    },
  }
}

export const queuedWorkspaceFsMutationCount = (): number => queuedWorkspaceFsMutations.length

export const resetWorkspaceFsMutationsForTests = (): void => {
  queuedWorkspaceFsMutations.length = 0
  consumerCursors.clear()
  nextSeq = 1
  nextConsumerId = 1
  workspaceFsMutationNotice.value = null
}

export const notifyWorkspaceFsMutation = (projectRoot: string, paths: string[]): void => {
  const directories = [...new Set(paths.flatMap(ancestorDirectories))]
  const payload: WorkspaceTreeChanged = {
    rootPath: projectRoot,
    directories,
    rescan: false,
  }
  const seq = nextSeq
  nextSeq += 1
  if (consumerCursors.size > 0) {
    queuedWorkspaceFsMutations.push({ seq, payload })
  }
  const previous = workspaceFsMutationNotice.value
  workspaceFsMutationNotice.value = {
    payload,
    nonce: (previous?.nonce ?? 0) + 1,
  }
}
