<script setup>
import AppHeader from './components/AppHeader.vue'
import ExplorePanel from './components/ExplorePanel.vue'
import WishlistPanel from './components/WishlistPanel.vue'
import RatingsPanel from './components/RatingsPanel.vue'
import { useRankings } from './composables/useRankings.js'

const {
  TABS,
  genres,
  activeTab,
  activeGenre,
  searchQuery,
  filteredItems,
  wishlistItems,
  ratedItems,
  setTab,
  setGenre,
  toggleWishlist,
  setRating,
  clearRating,
  isWishlisted,
  getRating,
  getPosterUrl,
  handlePosterError,
  getMetaLine,
} = useRankings()
</script>

<template>
  <div class="page">
    <AppHeader :tabs="TABS" :active-tab="activeTab" @select-tab="setTab" />

    <main class="content">
      <ExplorePanel
        v-if="activeTab === 'Explore'"
        v-model:search-query="searchQuery"
        :genres="genres"
        :active-genre="activeGenre"
        :items="filteredItems"
        :get-poster-url="getPosterUrl"
        :get-meta-line="getMetaLine"
        :is-wishlisted="isWishlisted"
        :get-rating="getRating"
        @set-genre="setGenre"
        @toggle-wishlist="toggleWishlist"
        @set-rating="setRating"
        @clear-rating="clearRating"
        @poster-error="handlePosterError"
      />

      <WishlistPanel
        v-else-if="activeTab === 'Wishlist'"
        :items="wishlistItems"
        :get-poster-url="getPosterUrl"
        :get-meta-line="getMetaLine"
        @toggle-wishlist="toggleWishlist"
        @poster-error="handlePosterError"
      />

      <RatingsPanel
        v-else
        :items="ratedItems"
        :get-poster-url="getPosterUrl"
        :get-meta-line="getMetaLine"
        :get-rating="getRating"
        @clear-rating="clearRating"
        @poster-error="handlePosterError"
      />
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px 24px 48px;
  max-width: 1200px;
  margin: 0 auto;
  color: #f9fafb;
}

.content {
  margin-top: 24px;
}

@media (max-width: 640px) {
  .page {
    padding: 24px 16px 32px;
  }
}
</style>
