import { toast } from 'vue-sonner'
import { runAtomicFlip } from '@/composables/use-theme-flip'
import { applyWindowVibrancy } from '@/services/vibrancy'
import formatUnknownError from '@/utils/format-unknown-error'

export default () => {
  const mode = useColorMode()
  const config = useVixlConfig()
  const { transparencyEnabled } = useTransparency()

  const syncTheme = async (): Promise<void> => {
    const theme = config.effectiveSettings.value['appearance.theme'] ?? 'system'
    const target = theme === 'system' ? 'auto' : theme
    const nextDark =
      target === 'auto' ? mode.system.value === 'dark' : target === 'dark'

    if (transparencyEnabled.value) {
      const hue =
        config.effectiveSettings.value['appearance.transparencyHue'] ?? 265
      const intensity =
        config.effectiveSettings.value['appearance.transparencyIntensity'] ?? 0
      try {
        await runAtomicFlip({
          cssFlip: () => {
            mode.value = target
          },
          nativeApply: () =>
            applyWindowVibrancy({ dark: nextDark, hue, intensity }),
        })
      } catch (error) {
        toast.error('Failed to apply window transparency', {
          description: formatUnknownError(error),
        })
      }
    } else {
      await runAtomicFlip({
        cssFlip: () => {
          mode.value = target
        },
      })
    }
  }

  watch(
    () => [
      config.effectiveSettings.value['appearance.theme'],
      config.hydrated.value,
      mode.system.value,
    ],
    () => {
      if (config.hydrated.value) {
        syncTheme().catch((error: unknown) => {
          toast.error('Failed to apply theme', {
            description: formatUnknownError(error),
          })
        })
      }
    },
    { deep: true },
  )

  onMounted(() => {
    if (config.hydrated.value) {
      syncTheme().catch((error: unknown) => {
        toast.error('Failed to apply theme', {
          description: formatUnknownError(error),
        })
      })
    }
  })

  return { syncTheme }
}
