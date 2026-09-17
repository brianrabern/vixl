import type { Editor, JSONContent } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChatPromptInputContextMenu from '@/components/chat/ChatPromptInputContextMenu.vue'
import useChatPromptEditor from '@/composables/use-chat-prompt-editor'

const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())
const writeText = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>())
const readText = vi.hoisted(() => vi.fn<() => Promise<string>>())

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: () => readText(),
  writeText: (text: string) => writeText(text),
}))

vi.mock('@/components/shadcn/ui/context-menu', () => ({
  ContextMenu: {
    name: 'ContextMenu',
    emits: ['update:open'],
    template: '<div data-testid="prompt-context-menu"><slot /></div>',
  },
  ContextMenuTrigger: {
    name: 'ContextMenuTrigger',
    template: '<div data-testid="prompt-context-menu-trigger"><slot /></div>',
  },
  ContextMenuContent: {
    name: 'ContextMenuContent',
    template: '<div data-testid="prompt-context-menu-content"><slot /></div>',
  },
  ContextMenuItem: {
    name: 'ContextMenuItem',
    props: {
      disabled: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['select'],
    template:
      '<button type="button" :disabled="disabled" data-testid="prompt-context-menu-item" @click="$emit(\'select\')"><slot /></button>',
  },
  ContextMenuShortcut: {
    name: 'ContextMenuShortcut',
    template: '<span><slot /></span>',
  },
}))

interface FakeSelection {
  from: number
  to: number
  empty: boolean
}

interface FakeLeafNode {
  type: { name: string }
  text?: string
  attrs: Record<string, unknown>
}

interface FakeEditor {
  schema: {
    nodes: Record<string, { spec: { toText?: (props: { node: FakeLeafNode }) => string } }>
  }
  state: {
    selection: FakeSelection
    doc: {
      textBetween: (
        from: number,
        to: number,
        blockSeparator?: string,
        leafText?: string | ((node: Node) => string),
      ) => string
    }
  }
  chain: () => FakeChain
  on: (event: string, handler: () => void) => void
  off: (event: string, handler: () => void) => void
}

interface FakeChain {
  focus: () => FakeChain
  selectAll: () => FakeChain
  deleteSelection: () => FakeChain
  splitBlock: () => FakeChain
  insertContent: (content: JSONContent | JSONContent[]) => FakeChain
  setTextSelection: (range: { from: number; to: number }) => FakeChain
  run: () => boolean
}

const mentionLeafText = (node: FakeLeafNode): string => {
  const label = String(node.attrs.label ?? node.attrs.id ?? '')
  return `@${label}`
}

const createFakeEditor = (
  selection: FakeSelection,
  selectedText: string,
  leafNodes: FakeLeafNode[] = [],
): {
  editor: FakeEditor
  commands: string[]
  emit: (event: string) => void
} => {
  const commands: string[] = []
  const listeners = new Map<string, Set<() => void>>()
  const emit = (event: string): void => {
    listeners.get(event)?.forEach((handler) => {
      handler()
    })
  }

  const chain = (): FakeChain => {
    const self: FakeChain = {
      focus: () => {
        commands.push('focus')
        return self
      },
      selectAll: () => {
        commands.push('selectAll')
        return self
      },
      deleteSelection: () => {
        commands.push('deleteSelection')
        return self
      },
      splitBlock: () => {
        commands.push('splitBlock')
        return self
      },
      setTextSelection: (range: { from: number; to: number }) => {
        commands.push(`setTextSelection:${range.from}:${range.to}`)
        return self
      },
      insertContent: (content: JSONContent | JSONContent[]) => {
        commands.push(`insertContent:${JSON.stringify(content)}`)
        return self
      },
      run: () => {
        commands.push('run')
        return true
      },
    }
    return self
  }

  const editor: FakeEditor = {
    schema: {
      nodes: {
        mention: {
          spec: {
            toText: ({ node }) => mentionLeafText(node),
          },
        },
      },
    },
    state: {
      selection,
      doc: {
        textBetween: (
          from: number,
          to: number,
          _blockSeparator?: string,
          leafText?: string | ((node: Node) => string),
        ) => {
          if (from !== selection.from || to !== selection.to) {
            return ''
          }
          if (leafNodes.length === 0) {
            return selectedText
          }
          return leafNodes
            .map((node) => {
              if (typeof node.text === 'string') {
                return node.text
              }
              if (typeof leafText === 'function') {
                return leafText(node as unknown as Node)
              }
              if (typeof leafText === 'string') {
                return leafText
              }
              return ''
            })
            .join('')
        },
      },
    },
    chain,
    on: (event: string, handler: () => void) => {
      const existing = listeners.get(event)
      if (existing) {
        existing.add(handler)
        return
      }
      listeners.set(event, new Set([handler]))
    },
    off: (event: string, handler: () => void) => {
      listeners.get(event)?.delete(handler)
    },
  }

  return { editor, commands, emit }
}

const insertText = vi.fn<(text: string) => void>()

const registerFakeEditor = (
  selection: FakeSelection,
  selectedText: string,
  leafNodes: FakeLeafNode[] = [],
): { editor: FakeEditor; commands: string[]; emit: (event: string) => void } => {
  const fake = createFakeEditor(selection, selectedText, leafNodes)
  useChatPromptEditor().registerEditor(
    fake.editor as unknown as Editor,
    null,
    insertText,
  )
  return fake
}

const mountMenu = () =>
  mount(ChatPromptInputContextMenu, {
    slots: {
      default: '<textarea data-testid="prompt-slot" />',
    },
  })

const itemByLabel = (
  wrapper: ReturnType<typeof mountMenu>,
  label: string,
) => {
  const match = wrapper
    .findAll('[data-testid="prompt-context-menu-item"]')
    .find((item) => item.text().includes(label))
  if (!match) {
    throw new Error(`Missing context menu item: ${label}`)
  }
  return match
}

beforeEach(() => {
  toastError.mockReset()
  writeText.mockReset()
  readText.mockReset()
  insertText.mockReset()
  writeText.mockResolvedValue(undefined)
  readText.mockResolvedValue('clipboard text')
})

afterEach(() => {
  useChatPromptEditor().registerEditor(null, null, null)
})

describe('ChatPromptInputContextMenu', () => {
  it('disables Cut and Copy when the selection is empty', () => {
    registerFakeEditor({ from: 1, to: 1, empty: true }, '')
    const wrapper = mountMenu()

    expect(itemByLabel(wrapper, 'Cut').attributes('disabled')).toBeDefined()
    expect(itemByLabel(wrapper, 'Copy').attributes('disabled')).toBeDefined()
    expect(itemByLabel(wrapper, 'Paste').attributes('disabled')).toBeUndefined()
    expect(itemByLabel(wrapper, 'Select All').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('copies the selected text to the clipboard', async () => {
    registerFakeEditor({ from: 1, to: 6, empty: false }, 'hello')
    const wrapper = mountMenu()

    expect(itemByLabel(wrapper, 'Copy').attributes('disabled')).toBeUndefined()
    await itemByLabel(wrapper, 'Copy').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('hello')
    wrapper.unmount()
  })

  it('copies mention leaf text with the surrounding selection', async () => {
    registerFakeEditor(
      { from: 1, to: 12, empty: false },
      'see ',
      [
        { type: { name: 'text' }, text: 'see ', attrs: {} },
        {
          type: { name: 'mention' },
          attrs: { label: 'somefile', id: 'file:src/somefile' },
        },
      ],
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Copy').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('see @somefile')
    wrapper.unmount()
  })

  it('cuts selected text then deletes the selection', async () => {
    const { commands } = registerFakeEditor(
      { from: 2, to: 7, empty: false },
      'world',
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Cut').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('world')
    expect(commands).toEqual([
      'focus',
      'run',
      'focus',
      'setTextSelection:2:7',
      'deleteSelection',
      'run',
    ])
    wrapper.unmount()
  })

  it('cuts mention leaf text then deletes the full selection', async () => {
    const { commands } = registerFakeEditor(
      { from: 1, to: 12, empty: false },
      'see ',
      [
        { type: { name: 'text' }, text: 'see ', attrs: {} },
        {
          type: { name: 'mention' },
          attrs: { label: 'somefile', id: 'file:src/somefile' },
        },
      ],
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Cut').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('see @somefile')
    expect(commands).toEqual([
      'focus',
      'run',
      'focus',
      'setTextSelection:1:12',
      'deleteSelection',
      'run',
    ])
    wrapper.unmount()
  })

  it('cuts the snapshotted range if selection changes during clipboard write', async () => {
    const selection = { from: 2, to: 7, empty: false }
    const { commands, emit } = registerFakeEditor(selection, 'world')
    const wrapper = mountMenu()

    writeText.mockImplementation(async () => {
      selection.from = 10
      selection.to = 15
      emit('transaction')
    })

    await itemByLabel(wrapper, 'Cut').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('world')
    expect(commands).toEqual([
      'focus',
      'run',
      'focus',
      'setTextSelection:2:7',
      'deleteSelection',
      'run',
    ])
    wrapper.unmount()
  })

  it('pastes clipboard text at the current caret', async () => {
    const { commands } = registerFakeEditor(
      { from: 1, to: 1, empty: true },
      '',
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Paste').trigger('click')
    await flushPromises()

    expect(readText).toHaveBeenCalledTimes(1)
    expect(insertText).not.toHaveBeenCalled()
    expect(commands).toEqual([
      'focus',
      `insertContent:${JSON.stringify([{ type: 'text', text: 'clipboard text' }])}`,
      'run',
    ])
    wrapper.unmount()
  })

  it('pastes markup-like clipboard text as plain text nodes', async () => {
    readText.mockResolvedValue('look <b>bold</b>')
    const { commands } = registerFakeEditor(
      { from: 1, to: 1, empty: true },
      '',
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Paste').trigger('click')
    await flushPromises()

    expect(commands).toEqual([
      'focus',
      `insertContent:${JSON.stringify([{ type: 'text', text: 'look <b>bold</b>' }])}`,
      'run',
    ])
    expect(commands.join('\n')).not.toContain('insertContent:look <b>bold</b>')
    wrapper.unmount()
  })

  it('pastes multi-line clipboard text as separate paragraphs', async () => {
    readText.mockResolvedValue('hello\nworld')
    const { commands } = registerFakeEditor(
      { from: 1, to: 1, empty: true },
      '',
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Paste').trigger('click')
    await flushPromises()

    expect(commands).toEqual([
      'focus',
      `insertContent:${JSON.stringify([{ type: 'text', text: 'hello' }])}`,
      'splitBlock',
      `insertContent:${JSON.stringify([{ type: 'text', text: 'world' }])}`,
      'run',
    ])
    wrapper.unmount()
  })

  it('selects all in the registered editor', async () => {
    const { commands } = registerFakeEditor(
      { from: 1, to: 1, empty: true },
      '',
    )
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Select All').trigger('click')

    expect(commands).toEqual(['focus', 'selectAll', 'run'])
    wrapper.unmount()
  })

  it('toasts when clipboard write fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    registerFakeEditor({ from: 1, to: 5, empty: false }, 'fail')
    const wrapper = mountMenu()

    await itemByLabel(wrapper, 'Copy').trigger('click')
    await flushPromises()

    expect(toastError).toHaveBeenCalledWith('Could not copy', {
      description: 'denied',
    })
    wrapper.unmount()
  })
})
