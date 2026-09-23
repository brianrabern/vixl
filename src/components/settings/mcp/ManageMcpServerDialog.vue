<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Badge } from '@/components/shadcn/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/shadcn/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import SettingsInputPasswordInput from '@/components/settings/input/PasswordInput.vue'
import ManageMcpHttpAuthFields from '@/components/settings/mcp/ManageMcpHttpAuthFields.vue'
import type {
  McpConfig,
  McpInputDefinition,
  McpServerConfig,
} from '@/types/vixl/mcp-config'
import useManageMcpServerDialog from '@/composables/manage-mcp-server-dialog'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  serverId?: string | null
  initialConfig?: McpServerConfig | null
  mcpConfig: McpConfig
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [
    payload: {
      serverId: string
      previousId?: string
      config: McpServerConfig
      inputs: McpInputDefinition[]
      secretValues: Record<string, string>
    },
  ]
}>()

const {
  draftId,
  transport,
  command,
  argsText,
  url,
  envRows,
  headerRows,
  authMode,
  oauthClientId,
  asAllowlistText,
  oauthClientSecret,
  oauthClientSecretConfigured,
  oauthScopesText,
  oauthCallbackPort,
  oauthAuthServerMetadataUrl,
  addEnvRow,
  addHeaderRow,
  handleSave,
} = useManageMcpServerDialog(props, emit)
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(value) => emit('update:open', value)"
  >
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>Server ID <span class="text-destructive">*</span></Label>
          <Input
            v-model="draftId"
            :disabled="mode === 'edit'"
            placeholder="brave-search"
          />
        </div>

        <div class="space-y-2">
          <Label>Transport <span class="text-destructive">*</span></Label>
          <select
            v-model="transport"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse</option>
          </select>
        </div>

        <template v-if="transport === 'stdio'">
          <div class="space-y-2">
            <Label>Command <span class="text-destructive">*</span></Label>
            <Input
              v-model="command"
              placeholder="npx"
            />
            <p class="text-xs text-muted-foreground">
              PATH basename only (for example npx, uvx, or docker). Review before trusting.
            </p>
          </div>
          <div class="space-y-2">
            <Label>Args (comma-separated)</Label>
            <Input
              v-model="argsText"
              placeholder="-y, @brave/brave-search-mcp-server or run, -i, --rm, mcp/docker-server"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <Label>Secrets (env)</Label>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    aria-label="Add env var"
                    @click="addEnvRow"
                  >
                    <Plus class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add env var</TooltipContent>
              </Tooltip>
            </div>
            <div
              v-for="(row, index) in envRows"
              :key="`env-${index}`"
              class="space-y-2 rounded-md border border-border/50 p-3"
            >
              <div class="flex items-center gap-2">
                <Input
                  v-model="row.key"
                  class="flex-1"
                  placeholder="BRAVE_API_KEY"
                />
                <Badge
                  v-if="row.configured && !row.value.trim()"
                  variant="outline"
                >
                  Saved
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  @click="envRows = envRows.filter((_, i) => i !== index)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
              <SettingsInputPasswordInput
                v-model="row.value"
                :placeholder="
                  row.configured
                    ? 'Leave blank to keep saved value'
                    : 'Paste secret'
                "
              />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="space-y-2">
            <Label>URL <span class="text-destructive">*</span></Label>
            <Input
              v-model="url"
              placeholder="https://example.com/mcp"
            />
          </div>
          <ManageMcpHttpAuthFields
            v-model:auth-mode="authMode"
            v-model:header-rows="headerRows"
            v-model:oauth-client-id="oauthClientId"
            v-model:as-allowlist-text="asAllowlistText"
            v-model:oauth-client-secret="oauthClientSecret"
            v-model:oauth-scopes-text="oauthScopesText"
            v-model:oauth-callback-port="oauthCallbackPort"
            v-model:oauth-auth-server-metadata-url="oauthAuthServerMetadataUrl"
            :oauth-client-secret-configured="oauthClientSecretConfigured"
            @add-header="addHeaderRow"
          />
        </template>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
        >
          Cancel
        </Button>
        <Button
          type="button"
          @click="handleSave"
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
