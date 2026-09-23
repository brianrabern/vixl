<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Badge } from '@/components/shadcn/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import SettingsInputPasswordInput from '@/components/settings/input/PasswordInput.vue'
import type { HttpAuthMode } from '@/composables/manage-mcp-server-dialog/build-http-config'
import type { SecretRow } from '@/composables/manage-mcp-server-dialog/secret-rows'

const authMode = defineModel<HttpAuthMode>('authMode', { required: true })
const headerRows = defineModel<SecretRow[]>('headerRows', { required: true })
const oauthClientId = defineModel<string>('oauthClientId', { required: true })
const asAllowlistText = defineModel<string>('asAllowlistText', { required: true })
const oauthClientSecret = defineModel<string>('oauthClientSecret', { required: true })
const oauthScopesText = defineModel<string>('oauthScopesText', { required: true })
const oauthCallbackPort = defineModel<string>('oauthCallbackPort', { required: true })
const oauthAuthServerMetadataUrl = defineModel<string>('oauthAuthServerMetadataUrl', {
  required: true,
})

defineProps<{
  oauthClientSecretConfigured: boolean
}>()

const emit = defineEmits<{
  addHeader: []
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <Label>Auth type</Label>
      <select
        v-model="authMode"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
      >
        <option value="none">none</option>
        <option value="headers">headers</option>
        <option value="oauth">oauth</option>
      </select>
    </div>

    <div
      v-if="authMode === 'headers'"
      class="space-y-2"
    >
      <div class="flex items-center justify-between gap-2">
        <div>
          <Label>Secrets (headers)</Label>
          <p class="text-xs text-muted-foreground">
            Header name and value. Enter the secret once; it is stored in the keychain.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              aria-label="Add header"
              @click="emit('addHeader')"
            >
              <Plus class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add header</TooltipContent>
        </Tooltip>
      </div>
      <div
        v-for="(row, index) in headerRows"
        :key="`header-${index}`"
        class="space-y-2 rounded-md border border-border/50 p-3"
      >
        <div class="flex items-center gap-2">
          <Input
            v-model="row.key"
            class="flex-1"
            placeholder="Authorization"
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
            @click="headerRows = headerRows.filter((_, i) => i !== index)"
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

    <template v-if="authMode === 'oauth'">
      <div class="space-y-2">
        <Label>OAuth client ID (optional)</Label>
        <Input
          v-model="oauthClientId"
          placeholder="Leave blank for dynamic registration"
        />
      </div>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Label>Client secret (optional)</Label>
          <Badge
            v-if="oauthClientSecretConfigured && !oauthClientSecret.trim()"
            variant="outline"
          >
            Saved
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground">
          Stored in the keychain. Leave blank for public clients.
        </p>
        <SettingsInputPasswordInput
          v-model="oauthClientSecret"
          :placeholder="
            oauthClientSecretConfigured
              ? 'Leave blank to keep saved value'
              : 'Paste secret'
          "
        />
      </div>
      <div class="space-y-2">
        <Label>Allowed authorization servers (optional)</Label>
        <p class="text-xs text-muted-foreground">
          One origin URL per line. If empty, you confirm the server on first login.
        </p>
        <textarea
          v-model="asAllowlistText"
          class="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          placeholder="https://auth.example.com"
        />
      </div>
      <div class="space-y-2">
        <Label>Scopes (optional)</Label>
        <p class="text-xs text-muted-foreground">
          Comma-separated. Leave blank to use the server default.
        </p>
        <Input
          v-model="oauthScopesText"
          placeholder="openid, profile"
        />
      </div>
      <div class="space-y-2">
        <Label>Callback port (optional)</Label>
        <p class="text-xs text-muted-foreground">
          Leave blank to pick an available port.
        </p>
        <Input
          v-model="oauthCallbackPort"
          inputmode="numeric"
          placeholder="8080"
        />
      </div>
      <div class="space-y-2">
        <Label>Authorization server metadata URL (optional)</Label>
        <p class="text-xs text-muted-foreground">
          Leave blank to use the standard discovery URL.
        </p>
        <Input
          v-model="oauthAuthServerMetadataUrl"
          placeholder="https://auth.example.com/.well-known/oauth-authorization-server"
        />
      </div>
    </template>
  </div>
</template>
