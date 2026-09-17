import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import type { FileUIPart } from 'ai'
import { PromptInput } from '@/components/ai-elements/prompt-input'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'

const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const normalizeAttachmentFiles = vi.hoisted(
  () =>
    vi.fn<(files: FileUIPart[]) => Promise<FileUIPart[]>>(async (files) => files),
)
const resolveModelForRole = vi.hoisted(
  () => vi.fn<() => string | null>(() => 'openai::gpt-4o'),
)
const listConfiguredProviders = vi.hoisted(
  () => vi.fn<() => string[]>(() => ['openai']),
)

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock('@/utils/normalize-attachment-files', () => ({
  default: (files: FileUIPart[]) => normalizeAttachmentFiles(files),
}))

vi.mock('@/services/models/resolve-model-for-role', () => ({
  default: () => resolveModelForRole(),
}))

vi.mock('@/services/providers/list-configured-providers', () => ({
  default: () => listConfiguredProviders(),
}))

vi.mock('@/composables/use-fleet-registry', () => ({
  default: () => ({
    projects: { value: [] },
    activeProject: {
      value: {
        id: 'p1',
        name: 'Proj',
        rootPath: '/tmp/proj',
      },
    },
    loaded: { value: true },
    setActiveProject: vi.fn<(id: string) => Promise<void>>(),
  }),
}))

vi.mock('@/composables/use-vixl-config', () => ({
  default: () => ({
    effectiveSettings: { value: {} },
    hydrated: { value: true },
  }),
}))

vi.mock('@/composables/use-git-branches', () => ({
  default: () => ({
    isRepo: { value: false },
    setWorkspaceRoot: vi.fn<(root: string | null) => void>(),
  }),
}))

vi.mock('@/composables/use-chat-store', () => ({
  default: () => ({
    editingMessageId: { value: null },
    meta: { value: null },
    cancelEditMessage: vi.fn<() => void>(),
  }),
}))

vi.mock('@/composables/use-chat-context-budget-sync', () => ({
  default: () => ({
    draftMentions: { value: [] },
    setDraftSelection: vi.fn<(model: string, mode: string) => void>(),
    setDraftMentions: vi.fn<(mentions: unknown[]) => void>(),
  }),
}))

vi.mock('@/composables/use-chat-prompt-editor', () => ({
  default: () => ({
    editorRef: { value: null },
  }),
}))

vi.mock('@/composables/use-context-usage', () => ({
  default: () => ({
    free: { value: 0 },
  }),
}))

vi.mock('@/composables/use-mcp-servers', () => ({
  default: () => ({
    serverStates: { value: {} },
  }),
}))

vi.mock('@/composables/use-transparency', () => ({
  default: () => ({
    transparencyEnabled: { value: false },
  }),
}))

vi.mock('@/composables/use-root-effective-settings', () => ({
  default: () => ({
    settings: {
      value: {
        'agent.permissionLevel': 'allowlist',
      },
    },
  }),
}))

const imagePart = (): FileUIPart => ({
  type: 'file',
  url: 'data:image/png;base64,AAA',
  mediaType: 'image/png',
  filename: 'shot.png',
})

describe('ChatPromptInput handleSubmit', () => {
  beforeEach(() => {
    toastError.mockClear()
    normalizeAttachmentFiles.mockReset()
    normalizeAttachmentFiles.mockImplementation(async (files) => files)
    resolveModelForRole.mockReturnValue('openai::gpt-4o')
    listConfiguredProviders.mockReturnValue(['openai'])
  })

  it('toasts and does not emit submit when attachment normalization fails', async () => {
    normalizeAttachmentFiles.mockRejectedValueOnce(
      new Error('Image could not be compressed under the 3.75MB provider limit'),
    )

    const wrapper = shallowMount(ChatPromptInput)
    await flushPromises()

    await wrapper.findComponent(PromptInput).vm.$emit('submit', {
      text: 'caption',
      files: [imagePart()],
    })
    await flushPromises()

    expect(normalizeAttachmentFiles).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Could not attach image', {
      description: 'Image could not be compressed under the 3.75MB provider limit',
    })
    expect(wrapper.emitted('submit')).toBeUndefined()

    wrapper.unmount()
  })

  it('emits submit with normalized files when normalization succeeds', async () => {
    const normalized = {
      ...imagePart(),
      url: 'data:image/jpeg;base64,BBB',
      mediaType: 'image/jpeg',
      filename: 'shot.jpg',
    }
    normalizeAttachmentFiles.mockResolvedValueOnce([normalized])

    const wrapper = shallowMount(ChatPromptInput)
    await flushPromises()

    await wrapper.findComponent(PromptInput).vm.$emit('submit', {
      text: 'caption',
      files: [imagePart()],
    })
    await flushPromises()

    expect(toastError).not.toHaveBeenCalled()
    expect(wrapper.emitted('submit')).toEqual([
      [
        expect.objectContaining({
          text: 'caption',
          files: [normalized],
        }),
      ],
    ])

    wrapper.unmount()
  })
})
