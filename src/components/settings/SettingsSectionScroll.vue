<template>
  <section class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <div v-if="$slots.actions" class="flex shrink-0 items-center justify-end gap-2 pb-4">
      <slot name="actions" />
    </div>
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <slot />
    </div>
  </section>
</template>
