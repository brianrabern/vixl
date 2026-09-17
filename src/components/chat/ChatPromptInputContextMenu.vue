<script setup lang="ts">
import { toast } from 'vue-sonner'
import {
  ClipboardCopy,
  ClipboardPaste,
  Scissors,
  TextSelect,
} from '@lucide/vue'
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import { insertPlainText, plainTextFromRange } from '@/utils/chat-prompt-editor'
import formatUnknownError from '@/utils/format-unknown-error'

const { editorRef } = useChatPromptEditor()

const hasSelection = ref(false)
const selectionFrom = ref(0)
const selectionTo = ref(0)
const selectedText = ref('')

let detachEditor: (() => void) | null = null

const captureSelection = (): void => {
  const editor = editorRef.value
  if (!editor) {
    hasSelection.value = false
    selectionFrom.value = 0
    selectionTo.value = 0
    selectedText.value = ''
    return
  }

  const { from, to } = editor.state.selection
  hasSelection.value = !editor.state.selection.empty
  selectionFrom.value = from
  selectionTo.value = to
  selectedText.value = plainTextFromRange(editor, from, to)
}

const bindEditor = (): void => {
  detachEditor?.()
  detachEditor = null

  const editor = editorRef.value
  if (!editor) {
    captureSelection()
    return
  }

  const onSelection = (): void => {
    captureSelection()
  }

  editor.on('selectionUpdate', onSelection)
  editor.on('transaction', onSelection)
  captureSelection()
  detachEditor = (): void => {
    editor.off('selectionUpdate', onSelection)
    editor.off('transaction', onSelection)
  }
}

const focusEditor = (): boolean => {
  const editor = editorRef.value
  if (!editor) {
    return false
  }
  editor.chain().focus().run()
  return true
}

const handleMenuOpenChange = (open: boolean): void => {
  if (open) {
    captureSelection()
  }
}

const handleCopy = async (): Promise<void> => {
  if (!hasSelection.value) {
    return
  }

  const text = selectedText.value

  try {
    if (!focusEditor()) {
      toast.error('Could not copy', {
        description: 'The prompt editor is not ready',
      })
      return
    }
    await writeText(text)
  } catch (error) {
    toast.error('Could not copy', {
      description: formatUnknownError(error),
    })
  }
}

const handleCut = async (): Promise<void> => {
  if (!hasSelection.value) {
    return
  }

  const from = selectionFrom.value
  const to = selectionTo.value
  const text = selectedText.value

  try {
    const editor = editorRef.value
    if (!editor) {
      toast.error('Could not cut', {
        description: 'The prompt editor is not ready',
      })
      return
    }

    editor.chain().focus().run()
    await writeText(text)
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .deleteSelection()
      .run()
  } catch (error) {
    toast.error('Could not cut', {
      description: formatUnknownError(error),
    })
  }
}

const handlePaste = async (): Promise<void> => {
  try {
    const editor = editorRef.value
    if (!editor) {
      toast.error('Could not paste', {
        description: 'The prompt editor is not ready',
      })
      return
    }

    const text = await readText()
    if (!text) {
      return
    }

    insertPlainText(editor, text)
  } catch (error) {
    toast.error('Could not paste', {
      description: formatUnknownError(error),
    })
  }
}

const handleSelectAll = (): void => {
  const editor = editorRef.value
  if (!editor) {
    toast.error('Could not select all', {
      description: 'The prompt editor is not ready',
    })
    return
  }

  editor.chain().focus().selectAll().run()
}

watch(editorRef, () => {
  bindEditor()
}, { immediate: true })

onBeforeUnmount(() => {
  detachEditor?.()
})
</script>

<template>
  <ContextMenu @update:open="handleMenuOpenChange">
    <ContextMenuTrigger as-child>
      <div class="contents">
        <slot />
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent class="w-52">
      <ContextMenuItem :disabled="!hasSelection" @select="handleCut">
        <Scissors />
        Cut
        <ContextMenuShortcut>⌘X</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem :disabled="!hasSelection" @select="handleCopy">
        <ClipboardCopy />
        Copy
        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="handlePaste">
        <ClipboardPaste />
        Paste
        <ContextMenuShortcut>⌘V</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="handleSelectAll">
        <TextSelect />
        Select All
        <ContextMenuShortcut>⌘A</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
