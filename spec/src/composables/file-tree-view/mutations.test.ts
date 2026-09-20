import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import type { FileTreeMutationState } from '@/composables/file-tree-view/mutations'

const fsDelete = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const fsWriteFile = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const fsMkdir = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    fsDelete: (...args: unknown[]) => fsDelete(...args),
    fsWriteFile: (...args: unknown[]) => fsWriteFile(...args),
    fsMkdir: (...args: unknown[]) => fsMkdir(...args),
  }),
)

const mcpStop = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)

vi.mock('@/services/mcp/mcp-runtime', () => ({
  default: {
    stop: (...args: unknown[]) => mcpStop(...args),
  },
}))

vi.mock('vue-sonner', () => ({
  toast: {
    success: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  },
}))

const buildState = (
  overrides: Partial<FileTreeMutationState> = {},
): FileTreeMutationState => {
  const projectRoot =
    overrides.projectRoot
    ?? computed(() => '/tmp/proj' as string | null)

  return {
    props: { projectId: 'proj-1', selectedPath: null },
    emit: vi.fn<(event: 'select', path: string) => void>(),
    tree: ref(null),
    expandedPaths: ref(new Set(['.'])),
    selectedPath: ref(''),
    renamingPath: ref(null),
    deleteTarget: ref(null),
    deleting: ref(false),
    createDialogOpen: ref(false),
    createDialogMode: ref<'file' | 'folder'>('file'),
    createName: ref(''),
    creating: ref(false),
    projectRoot,
    refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ensureChildrenLoaded: vi
      .fn<(directoryPath: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('createFileTreeMutations delete', () => {
  beforeEach(() => {
    vi.resetModules()
    fsDelete.mockReset()
    fsDelete.mockResolvedValue(undefined)
    fsWriteFile.mockReset()
    fsWriteFile.mockResolvedValue(undefined)
    fsMkdir.mockReset()
    fsMkdir.mockResolvedValue(undefined)
    mcpStop.mockReset()
    mcpStop.mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it('deletes a directory with recursive true, refreshes, and toasts Folder deleted', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.deleteTarget.value = { path: 'src', isDirectory: true }
    const mutations = createFileTreeMutations(state)

    await mutations.handleDeleteConfirm()

    expect(fsDelete).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src',
      recursive: true,
      allowSensitive: true,
    })
    expect(state.refresh).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Folder deleted')
    expect(state.deleteTarget.value).toBeNull()
    expect(state.deleting.value).toBe(false)
  })

  it('deletes a file with recursive false and toasts File deleted', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.deleteTarget.value = { path: 'src/main.ts', isDirectory: false }
    const mutations = createFileTreeMutations(state)

    await mutations.handleDeleteConfirm()

    expect(fsDelete).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/main.ts',
      recursive: false,
      allowSensitive: true,
    })
    expect(toast.success).toHaveBeenCalledWith('File deleted')
  })

  it('keeps the delete snapshot when the dialog closes while delete is in flight', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    let resolveDelete!: () => void
    fsDelete.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = () => resolve()
        }),
    )

    const state = buildState()
    state.deleteTarget.value = { path: 'src/gone.ts', isDirectory: false }
    const mutations = createFileTreeMutations(state)

    const confirmPromise = mutations.handleDeleteConfirm()
    expect(state.deleting.value).toBe(true)

    mutations.handleDeleteOpenChange(false)
    expect(state.deleteTarget.value).toEqual({
      path: 'src/gone.ts',
      isDirectory: false,
    })

    resolveDelete()
    await confirmPromise

    expect(fsDelete).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/gone.ts',
      recursive: false,
      allowSensitive: true,
    })
    expect(toast.success).toHaveBeenCalledWith('File deleted')
  })

  it('clears deleteTarget when the dialog closes and delete is not in flight', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.deleteTarget.value = { path: 'src/main.ts', isDirectory: false }
    state.deleting.value = false
    const mutations = createFileTreeMutations(state)

    mutations.handleDeleteOpenChange(false)

    expect(state.deleteTarget.value).toBeNull()
  })

  it('does not clear deleteTarget when the dialog closes while deleting', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.deleteTarget.value = { path: 'src/main.ts', isDirectory: false }
    state.deleting.value = true
    const mutations = createFileTreeMutations(state)

    mutations.handleDeleteOpenChange(false)

    expect(state.deleteTarget.value).toEqual({
      path: 'src/main.ts',
      isDirectory: false,
    })
  })

  it('toasts an error and skips fsDelete when project root is missing', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState({
      projectRoot: computed(() => null),
    })
    state.deleteTarget.value = { path: 'src/main.ts', isDirectory: false }
    const mutations = createFileTreeMutations(state)

    await mutations.handleDeleteConfirm()

    expect(fsDelete).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Project root is unavailable')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('toasts an error when confirm runs without a delete target', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    const mutations = createFileTreeMutations(state)

    await mutations.handleDeleteConfirm()

    expect(fsDelete).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Failed to delete', {
      description: 'Nothing was selected to delete',
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('stops CodeGraph before deleting .codegraph', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.deleteTarget.value = { path: '.codegraph', isDirectory: true }
    const mutations = createFileTreeMutations(state)

    await mutations.handleDeleteConfirm()

    expect(mcpStop).toHaveBeenCalledWith('codegraph', undefined, '/tmp/proj')
    expect(fsDelete).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: '.codegraph',
      recursive: true,
      allowSensitive: true,
    })
    expect(mcpStop.mock.invocationCallOrder[0]).toBeLessThan(
      fsDelete.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    expect(toast.success).toHaveBeenCalledWith('Folder deleted')
  })

  it('toasts Failed to delete and does not claim success when fsDelete rejects', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    fsDelete.mockRejectedValueOnce(new Error('permission denied'))
    const state = buildState()
    state.deleteTarget.value = { path: 'src/main.ts', isDirectory: false }
    const mutations = createFileTreeMutations(state)

    await mutations.handleDeleteConfirm()

    expect(toast.error).toHaveBeenCalledWith('Failed to delete', {
      description: 'permission denied',
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(state.deleting.value).toBe(false)
  })
})

describe('createFileTreeMutations create parent override', () => {
  beforeEach(() => {
    vi.resetModules()
    fsWriteFile.mockReset()
    fsWriteFile.mockResolvedValue(undefined)
    fsMkdir.mockReset()
    fsMkdir.mockResolvedValue(undefined)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it('creates a file under an explicit parent dir', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.selectedPath.value = 'src/App.vue'
    const mutations = createFileTreeMutations(state)

    mutations.handleNewFile('src/components')
    state.createName.value = 'NewFile.vue'
    await mutations.handleCreateConfirm()

    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/components/NewFile.vue',
      content: '',
      allowSensitive: true,
    })
    expect(fsMkdir).not.toHaveBeenCalled()
  })

  it('creates a file in the selectedPath parent when no explicit parent is passed', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.selectedPath.value = 'src/App.vue'
    const mutations = createFileTreeMutations(state)

    mutations.handleNewFile()
    state.createName.value = 'NewFile.vue'
    await mutations.handleCreateConfirm()

    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/NewFile.vue',
      content: '',
      allowSensitive: true,
    })
  })

  it('clears the parent override after confirm so a later create uses selectedPath', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.selectedPath.value = 'src/App.vue'
    const mutations = createFileTreeMutations(state)

    mutations.handleNewFile('src/components')
    state.createName.value = 'First.vue'
    await mutations.handleCreateConfirm()

    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/components/First.vue',
      content: '',
      allowSensitive: true,
    })

    mutations.handleNewFile()
    state.createName.value = 'Second.vue'
    await mutations.handleCreateConfirm()

    expect(fsWriteFile).toHaveBeenLastCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/Second.vue',
      content: '',
      allowSensitive: true,
    })
  })

  it('clears the parent override when the create dialog is cancelled', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.selectedPath.value = 'src/App.vue'
    const mutations = createFileTreeMutations(state)

    mutations.handleNewFile('src/components')
    mutations.handleCreateDialogOpenChange(false)

    mutations.handleNewFile()
    state.createName.value = 'AfterCancel.vue'
    await mutations.handleCreateConfirm()

    expect(fsWriteFile).toHaveBeenCalledTimes(1)
    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/AfterCancel.vue',
      content: '',
      allowSensitive: true,
    })
  })

  it('creates a folder under an explicit parent dir', async () => {
    const { createFileTreeMutations } = await import(
      '@/composables/file-tree-view/mutations'
    )
    const state = buildState()
    state.selectedPath.value = 'src/App.vue'
    const mutations = createFileTreeMutations(state)

    mutations.handleNewFolder('src/components')
    state.createName.value = 'hooks'
    await mutations.handleCreateConfirm()

    expect(fsMkdir).toHaveBeenCalledWith({
      projectRoot: '/tmp/proj',
      path: 'src/components/hooks',
    })
    expect(fsWriteFile).not.toHaveBeenCalled()
  })
})
