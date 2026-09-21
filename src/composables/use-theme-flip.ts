import { nextTick } from 'vue'

const THEME_FLIP_CLASS = 'theme-flip'

let freezeCount = 0
let nativeApplyChain: Promise<void> = Promise.resolve()

const freezeThemeFlip = (): void => {
  freezeCount += 1
  document.documentElement.classList.add(THEME_FLIP_CLASS)
}

const unfreezeThemeFlip = (): void => {
  if (freezeCount === 0) {
    return
  }

  freezeCount -= 1
  if (freezeCount === 0) {
    document.documentElement.classList.remove(THEME_FLIP_CLASS)
  }
}

const waitAnimationFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })

const enqueueNativeApply = (task: () => Promise<void>): Promise<void> => {
  const run = nativeApplyChain.then(task)
  // Keep the chain usable after a rejected apply. The caller still sees
  // the rejection via `run`.
  nativeApplyChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export const runAtomicFlip = async (options?: {
  cssFlip?: () => void
  nativeApply?: () => Promise<void>
}): Promise<void> => {
  freezeThemeFlip()
  try {
    const prepareCssFlip = async (): Promise<void> => {
      if (!options?.cssFlip) {
        return
      }

      options.cssFlip()
      // useColorMode applies the theme class in a flush: 'post' watcher.
      // After nextTick the class is on html and vueuse has already flushed
      // computed styles (disableTransition). Native apply can start after that.
      await nextTick()
      // Force style and layout so any other cssFlip DOM writes are paid before native.
      const rootStyle = window.getComputedStyle(document.documentElement)
      rootStyle.getPropertyValue('height')
    }

    const nativeApply = options?.nativeApply
    if (nativeApply) {
      // Reserve the chain slot now so a later native-only call cannot
      // overtake this flip while we wait for nextTick.
      const prepared = prepareCssFlip()
      await enqueueNativeApply(async () => {
        await prepared
        await nativeApply()
      })
    } else {
      await prepareCssFlip()
    }

    await waitAnimationFrame()
    await waitAnimationFrame()
  } finally {
    unfreezeThemeFlip()
  }
}

export default () => ({
  runAtomicFlip,
})
