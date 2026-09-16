import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/vixl/vixl-tauri'
import invokeErrorMessage from '@/utils/invoke-error-message'

const isMissingClipboardImage = (error: unknown): boolean => {
  const message = invokeErrorMessage(error)
  return (
    message.includes('clipboard has no image') ||
    message.includes('not available in the requested format') ||
    message.includes('clipboard is empty')
  )
}

export default () => {
  const readNativeClipboardImage = async (): Promise<File | null> => {
    if (!isTauri()) {
      return null
    }

    try {
      const bytes = await invoke<Uint8Array>('read_clipboard_image_png')
      return new File([new Uint8Array(bytes)], `screenshot-${Date.now()}.png`, {
        type: 'image/png',
      })
    } catch (error) {
      if (isMissingClipboardImage(error)) {
        return null
      }
      throw error
    }
  }

  return { readNativeClipboardImage }
}
