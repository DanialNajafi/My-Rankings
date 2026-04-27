<script setup>
defineProps({
  item: { type: Object, required: true },
  posterUrl: { type: String, default: null },
  metaLine: { type: String, required: true },
  variant: {
    type: String,
    required: true,
    validator: (v) => ['explore', 'wishlist', 'ratings'].includes(v),
  },
  isWishlisted: { type: Boolean, default: false },
  rating: { type: [Number, null], default: null },
})

const emit = defineEmits(['toggle-wishlist', 'set-rating', 'clear-rating'])
</script>

<template>
  <article class="card">
    <div class="card-media">
      <img
        v-if="posterUrl"
        class="card-media-img"
        :src="posterUrl"
        :alt="item.title"
      />
      <div v-else class="card-media-placeholder">
        <span class="card-media-icon">🖼️</span>
      </div>
      <div v-if="variant !== 'ratings'" class="card-media-actions">
        <button
          type="button"
          class="icon-button"
          :class="{ 'icon-button--active': variant === 'wishlist' || isWishlisted }"
          @click="emit('toggle-wishlist', item.id)"
        >
          ♡
        </button>
      </div>
    </div>

    <div class="card-body">
      <h3 class="card-title">
        {{ item.title }}
      </h3>
      <p class="card-meta">
        {{ item.genres.join(', ') }}
      </p>
      <p class="card-meta subtle">
        {{ metaLine }}
      </p>

      <div v-if="variant === 'explore'" class="rating-row">
        <div class="rating-row-top">
          <span class="rating-label">Your rating</span>
          <button
            v-if="rating != null"
            type="button"
            class="clear-rating"
            @click="emit('clear-rating', item.id)"
          >
            Clear
          </button>
        </div>
        <div class="rating-inputs">
          <button
            v-for="n in 10"
            :key="n"
            type="button"
            class="rating-dot"
            :class="{ 'rating-dot--active': rating === n }"
            @click="emit('set-rating', item.id, n)"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <div v-else-if="variant === 'ratings'" class="rating-pill">
        <span class="rating-pill-label">Your rating</span>
        <span class="rating-pill-score">
          {{ rating }}/10
        </span>
        <button
          type="button"
          class="clear-rating clear-rating--pill"
          @click="emit('clear-rating', item.id)"
        >
          Clear
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  background: #020617;
  border-radius: 18px;
  border: 1px solid #111827;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-media {
  position: relative;
  padding: 16px 16px 0;
}

.card-media-placeholder {
  background: linear-gradient(to bottom, #1f2933, #020617);
  border-radius: 12px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-media-img {
  max-width: 100%;
  height: 220px;
  border-radius: 12px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

.card-media-icon {
  font-size: 32px;
  opacity: 0.8;
}

.card-media-actions {
  position: absolute;
  top: 20px;
  right: 24px;
  display: flex;
  gap: 8px;
}

.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  font-size: 16px;
}

.icon-button--active {
  background: #facc15;
  color: #111827;
}

.card-body {
  padding: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-meta {
  font-size: 12px;
  color: #e5e7eb;
}

.card-meta.subtle {
  color: #6b7280;
  margin-top: 2px;
}

.rating-row {
  margin-top: 12px;
}

.rating-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rating-label {
  font-size: 11px;
  color: #9ca3af;
}

.rating-inputs {
  margin-top: 6px;
  display: flex;
  flex-wrap: nowrap;
  gap: 2px;
  overflow: hidden;
}

.rating-dot {
  width: 23px;
  flex: 0 0 23px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: #020617;
  color: #9ca3af;
  font-size: 11px;
}

.rating-dot--active {
  background: #facc15;
  color: #111827;
}

.rating-pill {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #111827;
  border-radius: 999px;
  padding: 6px 12px;
}

.clear-rating {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 8px;
}

.clear-rating:hover {
  background: rgba(148, 163, 184, 0.12);
  color: #e5e7eb;
}

.clear-rating--pill {
  padding: 2px 8px;
  font-size: 12px;
}

.rating-pill-label {
  font-size: 12px;
  color: #9ca3af;
}

.rating-pill-score {
  font-size: 14px;
  font-weight: 600;
}
</style>
