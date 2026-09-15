import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import type { OrchestratorInput } from '@/types/harness/orchestrator-input'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { mockVixlTauri } from '../../../test-utils/mocks/vixl-tauri'

const persistLine = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const runHarnessStream = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
)
const runSideTask = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<string | null>>().mockResolvedValue(null),
)
const convertToModelMessages = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([]),
)

vi.mock('@/services/harness/orchestrator/persistence', () => ({
  persistLine: (...args: unknown[]) => persistLine(...args),
}))

vi.mock('@/services/harness/orchestrator/stream', () => ({
  default: (...args: unknown[]) => runHarnessStream(...args),
}))

vi.mock('@/services/harness/run-side-task', () => ({
  default: (...args: unknown[]) => runSideTask(...args),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    convertToModelMessages: (...args: unknown[]) =>
      convertToModelMessages(...args),
  }
})

vi.mock('@/services/vixl/vixl-tauri', () =>
  mockVixlTauri({
    readChatMeta: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
  }),
)

vi.mock('@/services/providers/create-model', () => ({
  default: vi.fn<() => Promise<{ id: string }>>(async () => ({ id: 'stub-model' })),
}))

vi.mock('@/services/harness/resolve-model-vision', () => ({
  default: vi.fn<() => Promise<boolean>>(async () => true),
}))

import runOrchestrator from '@/services/harness/orchestrator/run'

const filePart = {
  type: 'file' as const,
  mediaType: 'image/png',
  url: 'data:image/png;base64,AAA',
  filename: 'shot.png',
}

const imageOnlyUser: UIMessage = {
  id: 'user-1',
  role: 'user',
  parts: [filePart],
  metadata: {
    createdAt: '2026-01-01T00:00:00.000Z',
    model: 'openai::gpt-4o',
  },
}

const buildInput = (
  overrides: Partial<OrchestratorInput> = {},
): OrchestratorInput =>
  ({
    workspace: {
      projectSlug: 'proj',
      projectRoot: '/tmp/proj',
      projectName: 'proj',
    },
    projectSlug: 'proj',
    chatId: 'chat-1',
    projectRoot: '/tmp/proj',
    projectName: 'proj',
    mode: 'agent',
    modelId: 'gpt-4o',
    providerId: 'openai',
    settings: { version: 1 } as VixlSettings,
    messages: [imageOnlyUser],
    userText: '',
    mentions: [],
    signal: new AbortController().signal,
    onEvent: vi.fn<(...args: unknown[]) => void>(),
    sessionAllows: new Set<string>(),
    sessionDenies: new Set<string>(),
    ...overrides,
  }) as OrchestratorInput

describe('orchestrator run user persist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    persistLine.mockResolvedValue(undefined)
    runHarnessStream.mockResolvedValue(undefined)
    runSideTask.mockResolvedValue(null)
    convertToModelMessages.mockResolvedValue([])
  })

  it('persists image-only file parts when looking up the appended message by id', async () => {
    await runOrchestrator(
      buildInput({
        appendedUserMessageId: 'user-1',
        userText: '',
      }),
    )

    expect(persistLine).toHaveBeenCalledWith(
      'proj',
      'chat-1',
      expect.objectContaining({
        id: 'user-1',
        role: 'user',
        parts: [filePart],
      }),
    )
    const persisted = persistLine.mock.calls[0]?.[2] as {
      parts: Array<{ type: string; text?: string }>
    }
    expect(persisted.parts.some((part) => part.type === 'text')).toBe(false)
  })

  it('falls back to text match when no appended message id is provided', async () => {
    const textUser: UIMessage = {
      id: 'user-text',
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
    }

    await runOrchestrator(
      buildInput({
        messages: [textUser],
        userText: 'hello',
      }),
    )

    expect(persistLine).toHaveBeenCalledWith(
      'proj',
      'chat-1',
      expect.objectContaining({
        id: 'user-text',
        parts: [{ type: 'text', text: 'hello' }],
      }),
    )
  })

  it('skips title generation for an image-only first message', async () => {
    await runOrchestrator(
      buildInput({
        appendedUserMessageId: 'user-1',
        userText: '',
      }),
    )

    expect(runSideTask).not.toHaveBeenCalled()
  })
})
