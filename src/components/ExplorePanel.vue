<script setup>
import TitleCard from './TitleCard.vue'

defineProps({
  genres: { type: Array, required: true },
  activeGenre: { type: String, required: true },
  searchQuery: { type: String, required: true },
  items: { type: Array, required: true },
  getPosterUrl: { type: Function, required: true },
  getMetaLine: { type: Function, required: true },
  isWishlisted: { type: Function, required: true },
  getRating: { type: Function, required: true },
})

const emit = defineEmits([
  'update:searchQuery',
  'set-genre',
  'toggle-wishlist',
  'set-rating',
  'clear-rating',
])
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2 class="panel-title">Discover Titles</h2>
      <div class="panel-header-controls">
        <div class="chip-row">
          <button
            v-for="genre in genres"
            :key="genre"
            type="button"
            class="chip"
            :class="{ 'chip--active': activeGenre === genre }"
            @click="emit('set-genre', genre)"
          >
            {{ genre }}
          </button>
        </div>
        <input
          :value="searchQuery"
          type="search"
          class="search-input"
          placeholder="Search titles..."
          @input="emit('update:searchQuery', $event.target.value.trim())"
        />
      </div>
    </div>

    <div class="grid">
      <TitleCard
        v-for="item in items"
        :key="item.id"
        variant="explore"
        :item="item"
        :poster-url="getPosterUrl(item)"
        :meta-line="getMetaLine(item)"
        :is-wishlisted="isWishlisted(item.id)"
        :rating="getRating(item.id)"
        @toggle-wishlist="emit('toggle-wishlist', $event)"
        @set-rating="(id, score) => emit('set-rating', id, score)"
        @clear-rating="emit('clear-rating', $event)"
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

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.panel-header-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 20px;
  font-weight: 600;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border-radius: 999px;
  padding: 6px 14px;
  border: none;
  background: #020617;
  color: #e5e7eb;
  font-size: 12px;
}

.search-input {
  flex: 0 0 220px;
  max-width: 100%;
  border-radius: 999px;
  padding: 8px 14px;
  border: 1px solid #1f2937;
  background: #020617;
  color: #e5e7eb;
  font-size: 13px;
}

.search-input::placeholder {
  color: #6b7280;
}

.chip--active {
  background: #f9fafb;
  color: #111827;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

@media (max-width: 640px) {
  .panel {
    padding: 16px;
  }
}
</style>
