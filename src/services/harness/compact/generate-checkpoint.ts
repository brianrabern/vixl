import { generateText } from 'ai'
import type {
  GenerateCheckpointInput,
  GenerateCheckpointResult,
} from '@/types/harness/generate-checkpoint'
import loadPrompt from '@/services/prompts/load-prompt'
import toCachedInstructions from '@/services/models/to-cached-instructions'
import formatUnknownError from '@/utils/format-unknown-error'
import compactBudgets from './budgets'

const REQUIRED_SECTION_MARKERS = ['Goal', 'Next'] as const
const MIN_CHECKPOINT_CHARS = 80

const hasSectionMarker = (summary: string, marker: string): boolean =>
  new RegExp(
    `^\\s*(?:#{1,6}\\s+|\\*\\*\\s*)?${marker}\\b(?:\\s*\\*\\*)?\\s*:`,
    'm',
  ).test(summary)

const validateCheckpointSummary = (summary: string): void => {
  if (!summary) {
    throw new Error('Compaction returned empty summary')
  }

  const missing = REQUIRED_SECTION_MARKERS.filter(
    (marker) => !hasSectionMarker(summary, marker),
  )
  if (missing.length > 0) {
    throw new Error(
      `Compaction checkpoint missing required sections: ${missing.join(', ')}`,
    )
  }

  if (summary.length < MIN_CHECKPOINT_CHARS) {
    throw new Error(
      `Compaction checkpoint is too short (${summary.length} chars, min ${MIN_CHECKPOINT_CHARS})`,
    )
  }
}

export default async (
  input: GenerateCheckpointInput,
): Promise<GenerateCheckpointResult> => {
  const {
    model,
    modelRef,
    system,
    providerOptions,
    tools,
    messages,
    focus,
    signal,
  } = input

  try {
    const result = await generateText({
      model,
      instructions: toCachedInstructions(system, providerOptions),
      messages: [
        ...messages,
        {
          role: 'user',
          content: loadPrompt('system/compact.md', { focus }),
        },
      ],
      tools,
      toolChoice: 'none',
      maxOutputTokens: compactBudgets.COMPACT_MAX_OUTPUT_TOKENS,
      providerOptions,
      abortSignal: signal,
    })

    const summary = result.text.trim()
    validateCheckpointSummary(summary)

    return {
      summary,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
      responseId: result.response?.id,
      modelRef,
    }
  } catch (error) {
    throw new Error(formatUnknownError(error))
  }
}
