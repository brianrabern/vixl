import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { FileUIPart, UIMessage } from 'ai'
import type { AgentHarnessState } from '@/composables/agent-harness/types'

const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const toastSuccess = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

vi.mock('@/services/harness/restore-file-checkpoints', () => ({
  default: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  aggregateTurnFileDiffs: vi.fn<() => unknown[]>(),
  collectMutationsAfterUserMessage: vi.fn<() => unknown[]>(),
  resolveBaselinesForAgentTurn: vi.fn<() => unknown>(),
  resolveBaselinesForRevert: vi.fn<() => unknown[]>(),
}))

import createPersistence from '@/composables/agent-harness/persistence'

const imageFile: FileUIPart = {
  type: 'file',
  mediaType: 'image/png',
  url: 'data:image/png;base64,AAA',
  filename: 'shot.png',
}

const buildState = (lastUser: UIMessage | null): AgentHarnessState =>
  ({
    options: {
      projectSlug: 'proj',
      chatId: 'chat-1',
      projectRoot: '/tmp/proj',
      projectName: 'proj',
      standalone: false,
    },
    session: {
      getLastUserMessage: () => lastUser,
      truncateAfterLastUserMessage: vi
        .fn<(...args: unknown[]) => Promise<void>>()
        .mockResolvedValue(undefined),
      truncateBeforeMessage: vi
        .fn<(...args: unknown[]) => Promise<void>>()
        .mockResolvedValue(undefined),
      truncateAfterUserMessage: vi
        .fn<(...args: unknown[]) => Promise<void>>()
        .mockResolvedValue(undefined),
      timeline: ref(
        lastUser ? [{ type: 'user' as const, message: lastUser }] : [],
      ),
    },
    status: ref('ready'),
    workbench: {
      reloadWorkspaceFiles: vi.fn<(paths: string[]) => void>(),
    },
    chatStore: {
      editingMessageId: ref(lastUser?.id ?? null),
      cancelEditMessage: vi.fn<() => void>(),
    },
  }) as unknown as AgentHarnessState

describe('retryLastTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retries an image-only last user message with its file parts', async () => {
    const lastUser: UIMessage = {
      id: 'user-image',
      role: 'user',
      parts: [imageFile],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const persistence = createPersistence(buildState(lastUser), { send })

    await persistence.retryLastTurn({
      mode: 'agent',
      model: 'openai::gpt-4o',
    })

    expect(send).toHaveBeenCalledWith({
      text: '',
      mode: 'agent',
      model: 'openai::gpt-4o',
      reasoning: undefined,
      files: [imageFile],
      skipUserMessage: true,
      skipUserPersist: true,
      appendedUserMessageId: 'user-image',
      internal: true,
    })
  })

  it('retries a text last user message without attaching files', async () => {
    const lastUser: UIMessage = {
      id: 'user-text',
      role: 'user',
      parts: [{ type: 'text', text: '  hello  ' }],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const persistence = createPersistence(buildState(lastUser), { send })

    await persistence.retryLastTurn({
      mode: 'plan',
      model: 'openai::gpt-4o',
      reasoning: 'high',
    })

    expect(send).toHaveBeenCalledWith({
      text: 'hello',
      mode: 'plan',
      model: 'openai::gpt-4o',
      reasoning: 'high',
      skipUserMessage: true,
      skipUserPersist: true,
      appendedUserMessageId: 'user-text',
      internal: true,
    })
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty('files')
  })

  it('does not send when the last user message has no text and no files', async () => {
    const lastUser: UIMessage = {
      id: 'user-empty',
      role: 'user',
      parts: [{ type: 'text', text: '   ' }],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const persistence = createPersistence(buildState(lastUser), { send })

    await persistence.retryLastTurn({
      mode: 'agent',
      model: 'openai::gpt-4o',
    })

    expect(send).not.toHaveBeenCalled()
  })

  it('does not send while the parent turn is in flight', async () => {
    const lastUser: UIMessage = {
      id: 'user-image',
      role: 'user',
      parts: [imageFile],
    }
    const state = buildState(lastUser)
    state.status.value = 'streaming'
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const persistence = createPersistence(state, { send })

    await persistence.retryLastTurn({
      mode: 'agent',
      model: 'openai::gpt-4o',
    })

    expect(send).not.toHaveBeenCalled()
  })
})

describe('submitEditMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resends an image-only edited message with its file parts and no text', async () => {
    const lastUser: UIMessage = {
      id: 'user-image',
      role: 'user',
      parts: [imageFile],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const state = buildState(lastUser)
    const persistence = createPersistence(state, { send })

    await persistence.submitEditMessage({
      newContent: '   ',
      mode: 'agent',
      model: 'openai::gpt-4o',
    })

    expect(state.session.truncateAfterUserMessage).toHaveBeenCalledWith(
      'proj',
      'chat-1',
      'user-image',
    )
    expect(state.session.truncateBeforeMessage).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith({
      text: '',
      mode: 'agent',
      model: 'openai::gpt-4o',
      reasoning: undefined,
      files: [imageFile],
      skipUserMessage: true,
      skipUserPersist: true,
      appendedUserMessageId: 'user-image',
      internal: true,
    })
    expect(send.mock.calls[0]?.[0]).not.toMatchObject({
      text: 'See attached image(s).',
    })
  })

  it('preserves original file parts when the edited text is not empty', async () => {
    const lastUser: UIMessage = {
      id: 'user-mixed',
      role: 'user',
      parts: [{ type: 'text', text: 'old caption' }, imageFile],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const state = buildState(lastUser)
    const persistence = createPersistence(state, { send })

    await persistence.submitEditMessage({
      newContent: 'new caption',
      mode: 'plan',
      model: 'openai::gpt-4o',
      reasoning: 'high',
    })

    expect(state.session.truncateBeforeMessage).toHaveBeenCalledWith(
      'proj',
      'chat-1',
      'user-mixed',
    )
    expect(state.session.truncateAfterUserMessage).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith({
      text: 'new caption',
      mode: 'plan',
      model: 'openai::gpt-4o',
      reasoning: 'high',
      files: [imageFile],
      internal: true,
    })
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty('skipUserMessage')
  })

  it('does not reuse the old message when a captioned image is edited to empty text', async () => {
    const lastUser: UIMessage = {
      id: 'user-mixed',
      role: 'user',
      parts: [{ type: 'text', text: 'old caption' }, imageFile],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const state = buildState(lastUser)
    const persistence = createPersistence(state, { send })

    await persistence.submitEditMessage({
      newContent: '   ',
      mode: 'agent',
      model: 'openai::gpt-4o',
    })

    expect(state.session.truncateBeforeMessage).toHaveBeenCalledWith(
      'proj',
      'chat-1',
      'user-mixed',
    )
    expect(state.session.truncateAfterUserMessage).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith({
      text: '',
      mode: 'agent',
      model: 'openai::gpt-4o',
      reasoning: undefined,
      files: [imageFile],
      internal: true,
    })
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty('skipUserMessage')
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty('appendedUserMessageId')
  })

  it('toasts and does not send when the edited message has no text and no files', async () => {
    const lastUser: UIMessage = {
      id: 'user-empty',
      role: 'user',
      parts: [{ type: 'text', text: '   ' }],
    }
    const send = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const state = buildState(lastUser)
    const persistence = createPersistence(state, { send })

    await persistence.submitEditMessage({
      newContent: '   ',
      mode: 'agent',
      model: 'openai::gpt-4o',
    })

    expect(send).not.toHaveBeenCalled()
    expect(state.session.truncateBeforeMessage).not.toHaveBeenCalled()
    expect(state.session.truncateAfterUserMessage).not.toHaveBeenCalled()
    expect(state.chatStore.cancelEditMessage).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Message cannot be empty')
  })
})

