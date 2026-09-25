import { nextTick } from 'vue'

export default async (path: string): Promise<void> => {
  await nextTick()
  const escaped = CSS.escape(path)
  let element = document.querySelector(`[data-path="${escaped}"]`)
  if (!(element instanceof HTMLElement)) {
    await nextTick()
    element = document.querySelector(`[data-path="${escaped}"]`)
  }
  if (element instanceof HTMLElement) {
    element.scrollIntoView({ block: 'nearest' })
  }
}
