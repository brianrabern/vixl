import type { Editor } from '@tiptap/core'
import plainTextToDoc from './plain-text-to-doc'

export default (editor: Editor, plainText: string): void => {
  if (!plainText) {
    return
  }

  const paragraphs = plainTextToDoc(plainText).content ?? []
  const chain = editor.chain().focus()
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) {
      chain.splitBlock()
    }
    const nodes = paragraph.content
    if (nodes && nodes.length > 0) {
      chain.insertContent(nodes)
    }
  })
  chain.run()
}
