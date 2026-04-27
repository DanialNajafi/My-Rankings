<script setup>
import TitleCard from './TitleCard.vue'

defineProps({
  items: { type: Array, required: true },
  getPosterUrl: { type: Function, required: true },
  getMetaLine: { type: Function, required: true },
})

const emit = defineEmits(['toggle-wishlist', 'poster-error'])
</script>

<template>
  <section class="panel">
    <div v-if="items.length === 0" class="empty-state">
      <div class="empty-icon">✨</div>
      <h2 class="empty-title">Your wishlist is empty</h2>
      <p class="empty-text">
        Start adding content from the Explore tab!
      </p>
    </div>

    <div v-else class="grid">
      <TitleCard
        v-for="item in items"
        :key="item.id"
        variant="wishlist"
        :item="item"
        :poster-url="getPosterUrl(item)"
        :meta-line="getMetaLine(item)"
        :is-wishlisted="true"
        :rating="null"
        @toggle-wishlist="emit('toggle-wishlist', $event)"
        @poster-error="(item, url) => emit('poster-error', item, url)"
      />
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: #020617;
  border-radius: 24px;
  padding: 24px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.empty-state {
  padding: 64px 16px;
  text-align: center;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 14px;
  color: #9ca3af;
}

@media (max-width: 640px) {
  .panel {
    padding: 16px;
  }
}
</style>
