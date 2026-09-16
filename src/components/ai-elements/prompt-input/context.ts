import type { AttachmentFile, PromptInputContext, PromptInputMessage } from './types'
import { nanoid } from 'nanoid'
import { inject, onBeforeUnmount, provide, ref } from 'vue'
import detachFileBytes from '@/utils/detach-file-bytes'
import { PROMPT_INPUT_KEY } from './types'

export function usePromptInputProvider(props: {
  initialInput?: string
  maxFiles?: number
  maxFileSize?: number
  accept?: string
  onSubmit?: (message: PromptInputMessage) => void | Promise<void>
  onError?: (err: { code: string, message: string }) => void
}) {
  const textInput = ref(props.initialInput || '')
  const files = ref<AttachmentFile[]>([])
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const isLoading = ref(false)
  const pendingAttaches = new Set<Promise<void>>()
  let attachEpoch = 0

  const revokeObjectUrl = (file: AttachmentFile) => {
    if (file.url && file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url)
    }
  }

  const revokeObjectUrls = (items: AttachmentFile[]) => {
    items.forEach(revokeObjectUrl)
  }

  // Cleanup object URLs to avoid memory leaks
  onBeforeUnmount(() => {
    revokeObjectUrls(files.value)
  })

  const setTextInput = (val: string) => {
    textInput.value = val
  }

  const matchesAccept = (file: File) => {
    if (!props.accept || props.accept.trim() === '')
      return true

    const patterns = props.accept
      .split(',')
      .map(pattern => pattern.trim())
      .filter(Boolean)

    const fileName = file.name.toLowerCase()
    const fileType = file.type.toLowerCase()

    // Clipboard pastes often omit MIME type. Treat empty type as an image when
    // the accept filter is image-only.
    if (!fileType) {
      return patterns.some((pattern) => {
        const normalizedPattern = pattern.toLowerCase()
        return (
          normalizedPattern === 'image/*' ||
          normalizedPattern.startsWith('image/') ||
          (normalizedPattern.startsWith('.') && fileName.endsWith(normalizedPattern))
        )
      })
    }

    return patterns.some((pattern) => {
      const normalizedPattern = pattern.toLowerCase()

      if (normalizedPattern.startsWith('.')) {
        return fileName.endsWith(normalizedPattern)
      }

      if (normalizedPattern.endsWith('/*')) {
        return fileType.startsWith(normalizedPattern.slice(0, -1))
      }

      return fileType === normalizedPattern
    })
  }

  const inferMediaType = (file: File): string => {
    if (file.type) {
      return file.type
    }
    const name = file.name.toLowerCase()
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      return 'image/jpeg'
    }
    if (name.endsWith('.gif')) {
      return 'image/gif'
    }
    if (name.endsWith('.webp')) {
      return 'image/webp'
    }
    if (name.endsWith('.svg')) {
      return 'image/svg+xml'
    }
    return 'image/png'
  }

  const addFiles = (incoming: File[] | FileList): Promise<void> => {
    const operation = (async (): Promise<void> => {
      const epoch = attachEpoch
      try {
        const fileList = Array.from(incoming)

        // Validate Accept
        const accepted = fileList.filter(matchesAccept)
        if (fileList.length && accepted.length === 0) {
          props.onError?.({ code: 'accept', message: 'No files match the accepted types.' })
          return
        }

        // Validate Size
        const withinSize = (f: File) => (props.maxFileSize ? f.size <= props.maxFileSize : true)
        const sized = accepted.filter(withinSize)
        if (accepted.length > 0 && sized.length === 0) {
          props.onError?.({ code: 'max_file_size', message: 'All files exceed the maximum size.' })
          return
        }

        // Validate Count
        const currentCount = files.value.length
        const capacity = props.maxFiles ? Math.max(0, props.maxFiles - currentCount) : undefined
        const capped = typeof capacity === 'number' ? sized.slice(0, capacity) : sized

        if (typeof capacity === 'number' && sized.length > capacity) {
          props.onError?.({ code: 'max_files', message: 'Too many files. Some were not added.' })
        }

        const detachedOrNull = await Promise.all(
          capped.map(async (file) => {
            try {
              return await detachFileBytes(file)
            }
            catch {
              props.onError?.({
                code: 'attach_read_failed',
                message: 'Could not read the attached file. Try attaching it again.',
              })
              return null
            }
          }),
        )
        const detached = detachedOrNull.filter((file): file is File => file !== null)

        if (epoch !== attachEpoch) {
          return
        }

        const newAttachments: AttachmentFile[] = detached.map(file => ({
          id: nanoid(),
          type: 'file',
          url: URL.createObjectURL(file),
          mediaType: inferMediaType(file),
          filename: file.name || 'image.png',
          file,
        }))

        files.value = [...files.value, ...newAttachments]
      }
      catch {
        props.onError?.({
          code: 'attach_read_failed',
          message: 'Could not read the attached file. Try attaching it again.',
        })
      }
    })()
    pendingAttaches.add(operation)
    return operation.finally(() => {
      pendingAttaches.delete(operation)
    })
  }

  const removeFile = (id: string) => {
    const file = files.value.find(f => f.id === id)
    if (file)
      revokeObjectUrl(file)
    files.value = files.value.filter(f => f.id !== id)
  }

  const clearFiles = () => {
    attachEpoch += 1
    revokeObjectUrls(files.value)
    files.value = []
  }

  const clearSubmittedFiles = (submittedIds: Set<string>) => {
    if (submittedIds.size === 0)
      return

    const remainingFiles: AttachmentFile[] = []

    files.value.forEach((file) => {
      if (submittedIds.has(file.id)) {
        revokeObjectUrl(file)
      }
      else {
        remainingFiles.push(file)
      }
    })

    files.value = remainingFiles
  }

  const clearInput = () => {
    textInput.value = ''
  }

  const openFileDialog = () => {
    fileInputRef.value?.click()
  }

  const convertBlobToDataUrl = (blob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  }

  const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return convertBlobToDataUrl(blob)
    }
    catch {
      return null
    }
  }

  const submitForm = async () => {
    if (!props.onSubmit)
      return

    const inFlight = [...pendingAttaches]
    await Promise.all(inFlight)

    const submittedText = textInput.value
    const submittedFiles = [...files.value]
    const submittedIds = new Set(submittedFiles.map(file => file.id))

    try {
      isLoading.value = true
      // Process files (convert blobs to base64 if needed for AI SDK)
      const converted = await Promise.all(
        submittedFiles.map(async (item) => {
          if (item.file) {
            const dataUrl = await convertBlobToDataUrl(item.file)
            if (!dataUrl) {
              return null
            }
            return { ...item, url: dataUrl }
          }
          if (item.url && item.url.startsWith('blob:')) {
            const dataUrl = await convertBlobUrlToDataUrl(item.url)
            if (!dataUrl) {
              return null
            }
            return { ...item, url: dataUrl }
          }
          return item
        }),
      )
      const processedFiles = converted.filter(
        (item): item is AttachmentFile => item !== null,
      )

      if (processedFiles.length < submittedFiles.length) {
        props.onError?.({
          code: 'submit_error',
          message: 'Could not attach image. The preview expired. Try attaching it again.',
        })
      }

      if (!submittedText.trim() && processedFiles.length === 0) {
        return
      }

      const message = {
        text: submittedText,
        files: processedFiles,
      }

      // Clear only after onSubmit so listeners can still read editor mentions
      // (clearing textInput earlier wipes TipTap nodes and draftMentions).
      await props.onSubmit(message)

      clearInput()
      clearSubmittedFiles(submittedIds)
    }
    catch (e) {
      if (props.onError) {
        const errorMessage = e instanceof Error
          ? e.message
          : String(e) || 'An unknown error occurred during submission.'
        props.onError({
          code: 'submit_error',
          message: errorMessage,
        })
      }
    }
    finally {
      isLoading.value = false
    }
  }

  const context: PromptInputContext = {
    textInput,
    files,
    fileInputRef,
    isLoading,
    setTextInput,
    addFiles,
    removeFile,
    clearFiles,
    clearInput,
    openFileDialog,
    submitForm,
  }

  provide(PROMPT_INPUT_KEY, context)
  return context
}

export function usePromptInput() {
  const context = inject<PromptInputContext>(PROMPT_INPUT_KEY)
  if (!context) {
    throw new Error('usePromptInput must be used within a PromptInput component')
  }
  return context
}
