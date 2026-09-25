import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { HOME_WORKSPACE_ID, isHomeChatSlug } from '@/constants/home-chat'

const useChatProjectId = (): ComputedRef<string | null> => {
  const route = useRoute()
  const fleet = useFleetRegistry()

  return computed(() => {
    const slug = String(route.params.slug ?? '')
    const standalone =
      route.name === 'home-chat' ||
      route.name === 'home-chat-subagent' ||
      isHomeChatSlug(slug)
    if (standalone) {
      return HOME_WORKSPACE_ID
    }
    const project = fleet.projects.value.find((item) => item.slug === slug)
    return project?.id ?? fleet.activeProjectId.value
  })
}

export default useChatProjectId
