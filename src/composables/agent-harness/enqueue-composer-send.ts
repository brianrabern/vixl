import type { FileUIPart } from 'ai'
import type { ContextMention } from '@/types/harness/context-mention'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import type { VixlChatMode } from '@/types/vixl/vixl-settings'
import type { AgentHarnessState } from './types'

type ComposerSendArgs = {
  text: string
  files?: FileUIPart[]
  mode: VixlChatMode
  model: string
  reasoning?: ReasoningLevel
  mentions?: ContextMention[]
  skipUserMessage?: boolean
  skipUserPersist?: boolean
}

export default (
  messageQueue: AgentHarnessState['messageQueue'],
  args: ComposerSendArgs,
): void => {
  messageQueue.enqueue({
    text: args.text,
    files: args.files ?? [],
    mode: args.mode,
    model: args.model,
    reasoning: args.reasoning,
    mentions: args.mentions,
    skipUserMessage: args.skipUserMessage,
    skipUserPersist: args.skipUserPersist,
  })
}
