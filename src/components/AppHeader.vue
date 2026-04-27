<script setup>
defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
})

const emit = defineEmits(['select-tab'])
</script>

<template>
  <header class="header">
    <div class="header-title">MyRankings</div>
    <p class="header-subtitle">
      Discover, wishlist, and rate your favorite movies, series, and anime
    </p>

    <div class="tab-row">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        class="tab-button"
        :class="{ 'tab-button--active': activeTab === tab }"
        @click="emit('select-tab', tab)"
      >
        <span class="tab-icon" aria-hidden="true">
          <span v-if="tab === 'Explore'">🧭</span>
          <span v-else-if="tab === 'Wishlist'">♡</span>
          <span v-else-if="tab === 'Ratings'">⭐</span>
        </span>
        <span class="tab-label">
          {{ tab }}
        </span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  text-align: center;
  margin-bottom: 32px;
}

.header-title {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.header-subtitle {
  margin-top: 8px;
  color: #9ca3af;
  font-size: 14px;
}

.tab-row {
  display: inline-flex;
  gap: 8px;
  margin-top: 24px;
  padding: 4px;
  background: #111827;
  border-radius: 999px;
}

.tab-button {
  border-radius: 999px;
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: #d1d5db;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-button--active {
  background: #f9fafb;
  color: #111827;
}

.tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.tab-label {
  display: inline-block;
}
</style>
