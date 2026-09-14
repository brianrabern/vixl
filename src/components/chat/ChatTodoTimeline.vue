<script setup lang="ts">
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  XCircleIcon,
} from '@lucide/vue'
import type { TodoItem } from '@/types/harness/harness-event'
import { TaskItem } from '@/components/ai-elements/task'
import { cn } from '@/lib/utils'

defineProps<{
  todos: TodoItem[]
}>()

const statusIcon = (status: TodoItem['status']) => {
  if (status === 'completed') {
    return CheckCircle2Icon
  }
  if (status === 'in_progress') {
    return CircleDotIcon
  }
  if (status === 'cancelled') {
    return XCircleIcon
  }
  if (status === 'pending') {
    return CircleDashedIcon
  }
  return CircleIcon
}

const statusIconClass = (status: TodoItem['status']): string => {
  if (status === 'completed') {
    return 'text-emerald-500'
  }
  if (status === 'in_progress') {
    return 'text-primary'
  }
  if (status === 'cancelled') {
    return 'text-muted-foreground'
  }
  return 'text-muted-foreground'
}

const statusTextClass = (status: TodoItem['status']): string => {
  if (status === 'cancelled') {
    return 'text-muted-foreground line-through'
  }
  return 'text-muted-foreground'
}
</script>

<template>
  <div class="max-h-40 space-y-1.5 overflow-y-auto">
    <TaskItem
      v-for="todo in todos"
      :key="todo.id"
      class="flex items-start gap-2 text-xs"
    >
      <component
        :is="statusIcon(todo.status)"
        class="mt-0.5 size-3.5 shrink-0"
        :class="statusIconClass(todo.status)"
      />
      <span :class="cn('min-w-0 flex-1', statusTextClass(todo.status))">
        {{ todo.content }}
      </span>
    </TaskItem>
  </div>
</template>
