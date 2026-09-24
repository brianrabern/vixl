import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { toast } from 'vue-sonner'
import { mockTauriEvent } from '../../test-utils/mocks/tauri-event'
import { mockVixlTauri } from '../../test-utils/mocks/vixl-tauri'
import type { TreeNode } from '@/composables/file-tree-view/path-helpers'
import type { WorkspaceTreeChanged } from '@/composables/file-tree-view/merge-directory-children'
import type { FileTreeWorkspaceSyncState } from '@/composables/file-tree-view/workspace-tree-sync'

type TreeHandler = (event: { payload: WorkspaceTreeChanged }) => void

const isTauri = vi.hoisted(() => vi.fn<() => boolean>(() => true))
const watchWorkspace = vi.hoisted(
  () =>
    vi.fn<(args: { projectRoot: string; mode?: 'shallow' }) => Promise<string>>(async () => ''),
)
const unwatchWorkspace = vi.hoisted(
  () => vi.fn<(args: { projectRoot: string }) => Promise<void>>(async () => undefined),
)
const watchWorkspacePaths = vi.hoisted(
  () =>
    vi.fn<(args: { projectRoot: string; paths: string[] }) => Promise<void>>(async () => undefined),
)
const fsListDir = vi.hoisted(
  () =>
    vi.fn<
      (
        projectRoot: string,
        path: string,
      ) => Promise<Array<{ name: string; path: string; kind: string }>>
    >(async () => []),
)
const listen = vi.hoisted(
  () =>
    vi.fn<(event: string, handler: TreeHandler) => Promise<() => void>>(async () => () => {}),
)

vi.mock('@tauri-apps/api/event', () => mockTauriEvent({ listen }))

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    isTauri: () => isTauri(),
    watchWorkspace: (args: { projectRoot: string; mode?: 'shallow' }) => watchWorkspace(args),
    unwatchWorkspace: (args: { projectRoot: string }) => unwatchWorkspace(args),
    watchWorkspacePaths: (args: { projectRoot: string; paths: string[] }) =>
      watchWorkspacePaths(args),
    fsListDir: (
      projectRoot: string,
      path: string,
    ) => fsListDir(projectRoot, path),
  }),
)

vi.mock('vue-sonner', () => ({
  toast: {
    success: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  },
}))

const sampleTree = (): TreeNode => ({
  name: '.',
  path: '.',
  kind: 'directory',
  children: [
    { name: 'README.md', path: 'README.md', kind: 'file' },
    { name: 'src', path: 'src', kind: 'directory', children: [] },
  ],
})

let treeHandler: TreeHandler | null = null
let wrapper: VueWrapper | null = null

const resetDomListeners = (): void => {
  vi.spyOn(window, 'addEventListener').mockImplementation(() => undefined)
  vi.spyOn(document, 'addEventListener').mockImplementation(() => undefined)
  vi.spyOn(window, 'removeEventListener').mockImplementation(() => undefined)
  vi.spyOn(document, 'removeEventListener').mockImplementation(() => undefined)
}

const mountSync = async (state: FileTreeWorkspaceSyncState): Promise<void> => {
  const { bindFileTreeWorkspaceSync } = await import(
    '@/composables/file-tree-view/workspace-tree-sync'
  )
  const Harness = defineComponent({
    setup() {
      bindFileTreeWorkspaceSync(state)
      return () => null
    },
  })
  wrapper = mount(Harness)
  await flushPromises()
}

describe('bindFileTreeWorkspaceSync', () => {
  beforeEach(() => {
    vi.resetModules()
    isTauri.mockReset()
    isTauri.mockReturnValue(true)
    watchWorkspace.mockReset()
    watchWorkspace.mockResolvedValue('/canonical/me')
    unwatchWorkspace.mockReset()
    unwatchWorkspace.mockResolvedValue(undefined)
    watchWorkspacePaths.mockReset()
    watchWorkspacePaths.mockResolvedValue(undefined)
    fsListDir.mockReset()
    fsListDir.mockResolvedValue([
      { name: 'README.md', path: 'README.md', kind: 'file' },
      { name: 'src', path: 'src', kind: 'directory' },
    ])
    listen.mockReset()
    treeHandler = null
    listen.mockImplementation(async (event, handler) => {
      if (event === 'workspace-tree-changed') {
        treeHandler = handler
      }
      return () => {}
    })
    resetDomListeners()
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
  })

  it('matches workspace events against the canonical root from watch_workspace', async () => {
    const tree = ref<TreeNode | null>(sampleTree())
    const projectRoot = computed(() => '/Users/me')
    const refreshGit = vi.fn<() => Promise<void>>(async () => undefined)
    const onTreeChanged = vi.fn<() => void>()

    await mountSync({
      isHome: () => false,
      tree,
      expandedPaths: ref(new Set(['.'])),
      selectedPath: ref(''),
      renamingPath: ref(null),
      deleteTarget: ref(null),
      projectRoot,
      refreshGit,
      onTreeChanged,
    })

    expect(watchWorkspace).toHaveBeenCalledWith({ projectRoot: '/Users/me' })
    expect(treeHandler).not.toBeNull()

    treeHandler?.({
      payload: {
        rootPath: '/canonical/me',
        directories: ['.'],
        rescan: false,
      },
    })
    await flushPromises()

    expect(fsListDir).toHaveBeenCalledWith('/Users/me', '.')
    expect(onTreeChanged).toHaveBeenCalled()
  })

  it('rewatches when home mode changes for the same project root', async () => {
    const isHome = ref(true)
    const projectRoot = computed(() => '/Users/me')

    await mountSync({
      isHome: () => isHome.value,
      tree: ref(sampleTree()),
      expandedPaths: ref(new Set(['.'])),
      selectedPath: ref(''),
      renamingPath: ref(null),
      deleteTarget: ref(null),
      projectRoot,
      refreshGit: vi.fn<() => Promise<void>>(async () => undefined),
      onTreeChanged: vi.fn<() => void>(),
    })

    expect(watchWorkspace).toHaveBeenCalledWith({
      projectRoot: '/Users/me',
      mode: 'shallow',
    })
    expect(watchWorkspacePaths).toHaveBeenCalled()

    watchWorkspace.mockClear()
    unwatchWorkspace.mockClear()
    watchWorkspacePaths.mockClear()
    isHome.value = false
    await flushPromises()

    expect(unwatchWorkspace).toHaveBeenCalledWith({ projectRoot: '/canonical/me' })
    expect(watchWorkspace).toHaveBeenCalledWith({ projectRoot: '/Users/me' })
    expect(watchWorkspace).not.toHaveBeenCalledWith({
      projectRoot: '/Users/me',
      mode: 'shallow',
    })
    expect(watchWorkspacePaths).not.toHaveBeenCalled()
  })

  it('toasts when a home watch path update fails', async () => {
    watchWorkspacePaths.mockRejectedValue(new Error('watch failed'))
    const projectRoot = computed(() => '/Users/me')

    await mountSync({
      isHome: () => true,
      tree: ref(sampleTree()),
      expandedPaths: ref(new Set(['.'])),
      selectedPath: ref(''),
      renamingPath: ref(null),
      deleteTarget: ref(null),
      projectRoot,
      refreshGit: vi.fn<() => Promise<void>>(async () => undefined),
      onTreeChanged: vi.fn<() => void>(),
    })

    expect(toast.error).toHaveBeenCalledWith('Failed to watch workspace', {
      description: 'watch failed',
    })
  })

  it('relists once after load when an event arrived while the tree was empty', async () => {
    const tree = ref<TreeNode | null>(null)
    const projectRoot = computed(() => '/Users/me')
    const onTreeChanged = vi.fn<() => void>()

    await mountSync({
      isHome: () => false,
      tree,
      expandedPaths: ref(new Set(['.'])),
      selectedPath: ref(''),
      renamingPath: ref(null),
      deleteTarget: ref(null),
      projectRoot,
      refreshGit: vi.fn<() => Promise<void>>(async () => undefined),
      onTreeChanged,
    })

    treeHandler?.({
      payload: {
        rootPath: '/canonical/me',
        directories: ['.'],
        rescan: false,
      },
    })
    await flushPromises()
    expect(fsListDir).not.toHaveBeenCalled()

    tree.value = sampleTree()
    await flushPromises()

    expect(fsListDir).toHaveBeenCalledTimes(1)
    expect(fsListDir).toHaveBeenCalledWith('/Users/me', '.')
    expect(onTreeChanged).toHaveBeenCalled()
  })
})
