import { toast } from 'vue-sonner'
import type { FileUIPart } from 'ai'
import type { ContextMention } from '@/types/harness/context-mention'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { PermissionCapabilityKey } from '@/types/harness/permission'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import type { VixlChatMode, VixlSettings } from '@/types/vixl/vixl-settings'
import runOrchestrator from '@/services/harness/orchestrator'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import parseModelRef from '@/utils/parse-model-ref'
import { listAgentIndex } from '@/services/agents/registry'
import dropUnresolvedAgentMentions from '@/services/agents/drop-unresolved-agent-mentions'
import collectExplicitAgentMentions from '@/utils/collect-explicit-agent-mentions'
import { loadEffectiveSettings } from '@/services/config/vixl-config'
import flushPendingBackgroundResume from '@/services/harness/subagent/flush-pending-resume'
import { hasPendingBackgroundResume } from '@/services/harness/subagent/registry'
import normalizeAttachmentFiles from '@/utils/normalize-attachment-files'
import appendSendUserMessage from './append-send-user-message'
import applyParentTurnStart from './apply-parent-turn-start'
import deferOverlappingParentTurn from './defer-overlapping-parent-turn'
import enqueueComposerSend from './enqueue-composer-send'
import type { AgentHarnessState, AttentionHelpers } from './types'

export type SendArgs = {
  text: string
  mode: VixlChatMode
  model: string
  reasoning?: ReasoningLevel
  mentions?: ContextMention[]
  files?: FileUIPart[]
  skipUserMessage?: boolean
  skipUserPersist?: boolean
  // Internal sends (drain, retry, edit, forceSendQueued) bypass the outbound
  // composer busy enqueue. They still defer when compaction or a background
  // resume is in flight: drain/retry/edit re-enqueue, force-send waits first.
  internal?: boolean
}

type SendDeps = {
  handleEvent: (event: HarnessEvent) => void | Promise<void>
  persistPermission: (
    capability: PermissionCapabilityKey,
    verdict: 'allow' | 'deny',
    scope: 'workspace' | 'always',
  ) => Promise<void>
  maybeDrainQueue: () => Promise<void>
}

export default (
  state: AgentHarnessState,
  attention: AttentionHelpers,
  deps: SendDeps,
) => {
  const {
    options,
    session,
    config,
    status,
    error,
    toolRuns,
    abortController,
    resumingBackgroundBatch,
    compacting,
    sessionPermissionLevel,
    contextBudgetSync,
    fleetSidebar,
    messageQueue,
    suppressQueueDrainAfterStop,
  } = state

  const send = async (args: SendArgs): Promise<void> => {
    const pending = session.pendingQuestion.value
    if (!args.internal && pending && args.text.trim().length > 0) {
      session.submitAnswer(pending.toolCallId, args.text)
      attention.maybeClearAttentionWhenGatesEmpty()
      return
    }

    if (!args.internal && attention.isParentBusy()) {
      enqueueComposerSend(messageQueue, args)
      return
    }

    if (status.value === 'streaming' || status.value === 'submitted') {
      return
    }

    if (!args.model) {
      toast.error('Select a model before sending')
      return
    }

    if (!config.hydrated.value) {
      toast.error('Settings are still loading')
      return
    }

    if (listConfiguredProviders(config.effectiveSettings.value).length === 0) {
      toast.error('No provider configured', {
        description: 'Add a provider in Settings.',
      })
      return
    }

    const parsedModel = parseModelRef(args.model)
    if (!parsedModel) {
      toast.error('Select a valid model before sending')
      return
    }

    const projectRoot = options.standalone ? null : options.projectRoot
    let chatSettings: VixlSettings
    try {
      chatSettings = await loadEffectiveSettings(projectRoot)
    } catch (settingsError) {
      toast.error('Failed to load project settings', {
        description:
          settingsError instanceof Error ? settingsError.message : 'Unknown error',
      })
      return
    }

    if (!args.internal && attention.isParentBusy()) {
      enqueueComposerSend(messageQueue, args)
      return
    }

    error.value = null
    status.value = 'submitted'
    toolRuns.value = []

    const agentIndex = await listAgentIndex(projectRoot).catch(() => [])
    const mentions = await dropUnresolvedAgentMentions(
      collectExplicitAgentMentions(args.text, args.mentions ?? [], agentIndex),
      projectRoot,
    )

    const previousAbort = abortController.value
    const controller = new AbortController()
    abortController.value = controller
    let turnStarted = false

    try {
      let files: FileUIPart[]
      try {
        files = await normalizeAttachmentFiles(args.files ?? [])
      } catch (normalizeError) {
        toast.error('Could not attach image', {
          description:
            normalizeError instanceof Error
              ? normalizeError.message
              : 'Unknown error',
        })
        status.value = 'ready'
        await fleetSidebar.refreshSlug(options.projectSlug)
        return
      }

      let userMessageAppended = false
      if (!args.skipUserMessage) {
        const abortedBeforeAppend = await appendSendUserMessage({
          session,
          text: args.text,
          model: args.model,
          files,
          mentions,
          agentNames: agentIndex.map((agent) => agent.name),
          projectRoot,
          aborted: () => controller.signal.aborted,
        })
        if (abortedBeforeAppend) {
          status.value = 'ready'
          await fleetSidebar.refreshSlug(options.projectSlug)
          return
        }
        userMessageAppended = true
      }

      if (controller.signal.aborted) {
        status.value = 'ready'
        await fleetSidebar.refreshSlug(options.projectSlug)
        return
      }

      if (
        deferOverlappingParentTurn({
          resumeInFlight: resumingBackgroundBatch.value,
          compacting: compacting.value,
          enqueue: () =>
            enqueueComposerSend(messageQueue, {
              ...args,
              skipUserMessage: args.skipUserMessage || userMessageAppended,
              skipUserPersist: args.skipUserPersist || userMessageAppended,
            }),
          abortController,
          controller,
          previousAbort,
          status,
        })
      ) {
        await fleetSidebar.refreshSlug(options.projectSlug)
        return
      }

      await applyParentTurnStart({
        state,
        mode: args.mode,
        model: args.model,
        reasoning: args.reasoning,
        mentions,
        effectiveSettings: chatSettings,
      })

      const turnId = crypto.randomUUID()
      session.startAgentTurn(turnId)
      turnStarted = true
      suppressQueueDrainAfterStop.value = false
      if (
        !args.internal &&
        !resumingBackgroundBatch.value &&
        hasPendingBackgroundResume(options.chatId)
      ) {
        flushPendingBackgroundResume(options.chatId)
      }

      await runOrchestrator({
        workspace: options,
        projectSlug: options.projectSlug,
        chatId: options.chatId,
        projectRoot: options.projectRoot,
        projectName: options.projectName,
        mode: args.mode,
        modelId: parsedModel.modelId,
        providerId: parsedModel.providerId,
        settings: chatSettings,
        messages: session.messages.value,
        timeline: session.timeline.value,
        userText: args.text,
        mentions,
        signal: controller.signal,
        onEvent: deps.handleEvent,
        assistantId: turnId,
        skipUserPersist: args.skipUserPersist,
        standalone: options.standalone,
        permissionLevel: sessionPermissionLevel.value ?? undefined,
        persistPermission: deps.persistPermission,
        reasoning: args.reasoning,
        sessionAllows: state.sessionAllows,
        sessionDenies: state.sessionDenies,
      })
      status.value = 'ready'
      session.finishAgentTurn()
      attention.applyTurnEndAttention('success')
      await fleetSidebar.refreshSlug(options.projectSlug)
      if (!args.internal) {
        await deps.maybeDrainQueue()
      }
    } catch (err) {
      const aborted = controller.signal.aborted
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || /timeout/i.test(err.message))
      const message = err instanceof Error ? err.message : 'Unknown error'
      const payloadHint = /invalid json response body/i.test(message)
        ? ' The provider rejected the request payload. Try smaller or fewer images.'
        : ''
      if (aborted) {
        status.value = 'ready'
        if (turnStarted) {
          session.finishAgentTurn()
        }
        await fleetSidebar.refreshSlug(options.projectSlug)
        return
      }
      error.value = message
      status.value = 'error'
      if (turnStarted) {
        session.setAgentTurnError({
          kind: timedOut ? 'timeout' : 'error',
          message: timedOut
            ? 'The model took too long to respond.'
            : message.includes('No output generated')
              ? 'The model returned an empty response. Check your API key and model ID in Settings.'
              : `${message}${payloadHint}`,
        })
        session.finishAgentTurn()
        attention.applyTurnEndAttention('error')
      }
      toast.error('Agent run failed', {
        description: error.value.includes('No output generated')
          ? 'The model returned an empty response. Check your Gateway API key and model ID in Settings.'
          : `${error.value}${payloadHint}`,
      })
      await fleetSidebar.refreshSlug(options.projectSlug)
    } finally {
      contextBudgetSync.setDraftMentions([])
      if (abortController.value === controller) {
        abortController.value = null
      }
    }
  }

  return { send }
}
