import type { Editor } from '@tiptap/core'
import { getTextSerializersFromSchema } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'

export default (editor: Editor, from: number, to: number): string => {
  const textSerializers = getTextSerializersFromSchema(editor.schema)
  return editor.state.doc.textBetween(
    from,
    to,
    '\n',
    (node: Node) => {
      const serializer = textSerializers[node.type.name]
      if (!serializer) {
        return node.text ?? ''
      }
      return serializer({
        node,
        pos: from,
        parent: node,
        index: 0,
        range: { from, to },
      })
    },
  )
}
