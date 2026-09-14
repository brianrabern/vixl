import {
  clearPendingBackgroundResume,
  clearTurnResponseMessages,
  listSubagentsForChat,
  markBackgroundResultsDelivered,
} from '@/services/harness/subagent/registry'

const flushPendingBackgroundResume = (chatId: string): void => {
  markBackgroundResultsDelivered(
    chatId,
    listSubagentsForChat(chatId).map((record) => record.toolCallId),
  )
  clearTurnResponseMessages(chatId)
  clearPendingBackgroundResume(chatId)
}

export default flushPendingBackgroundResume
