<script setup>
import { computed, reactive, ref, onMounted } from 'vue'

const TABS = ['Explore', 'Wishlist', 'Ratings']

// OMDb API key from Vite env (see .env)
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY

const activeTab = ref('Explore')
const activeGenre = ref('All')

const genres = [
  'All',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Romance',
  'Supernatural',
]

const items = reactive([
  {
    id: 1,
    title: 'Inception',
    year: 2010,
    episodes: 1,
    genres: ['Action', 'Sci-Fi'],
  },
  {
    id: 2,
    title: 'Breaking Bad',
    year: 2008,
    episodes: 62,
    genres: ['Drama', 'Crime'],
  },
  {
    id: 3,
    title: 'Spirited Away',
    year: 2001,
    episodes: 1,
    genres: ['Fantasy', 'Animation'],
  },
  {
    id: 4,
    title: 'Attack on Titan',
    year: 2013,
    episodes: 87,
    genres: ['Action', 'Dark Fantasy'],
  },
])

// Store fetched poster URLs keyed by item id
const posters = reactive({})

const wishlist = reactive(new Set())
const ratings = reactive({})

async function fetchPosterForItem(item) {
  if (!OMDB_API_KEY) return

  try {
    const query = encodeURIComponent(item.title)
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${query}`
    const res = await fetch(url)
    const data = await res.json()

    if (data && data.Response === 'True' && data.Poster && data.Poster !== 'N/A') {
      posters[item.id] = data.Poster
    }
  } catch (e) {
    console.error('Failed to fetch poster for', item.title, e)
  }
}

async function fetchAllPosters() {
  for (const item of items) {
    await fetchPosterForItem(item)
  }
}

function getPosterUrl(item) {
  return posters[item.id] ?? null
}

onMounted(() => {
  fetchAllPosters()
})

const filteredItems = computed(() => {
  if (activeGenre.value === 'All') return items
  return items.filter((item) => item.genres.includes(activeGenre.value))
})

const wishlistItems = computed(() =>
  items.filter((item) => wishlist.has(item.id)),
)

const ratedItems = computed(() =>
  items.filter((item) => ratings[item.id] != null),
)

function setTab(tab) {
  activeTab.value = tab
}

function setGenre(genre) {
  activeGenre.value = genre
}

function toggleWishlist(id) {
  if (wishlist.has(id)) {
    wishlist.delete(id)
  } else {
    wishlist.add(id)
  }
}

function setRating(id, score) {
  ratings[id] = score
}

function clearRating(id) {
  delete ratings[id]
}

function isWishlisted(id) {
  return wishlist.has(id)
}

function getRating(id) {
  return ratings[id] ?? null
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header-title">MyRankings</div>
      <p class="header-subtitle">
        Discover, wishlist, and rate your favorite movies, series, and anime
      </p>

      <div class="tab-row">
        <button
          v-for="tab in TABS"
          :key="tab"
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === tab }"
          @click="setTab(tab)"
        >
          {{ tab }}
        </button>
      </div>
    </header>

    <main class="content">
      <section v-if="activeTab === 'Explore'" class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Discover Titles</h2>
          <div class="chip-row">
            <button
              v-for="genre in genres"
              :key="genre"
              type="button"
              class="chip"
              :class="{ 'chip--active': activeGenre === genre }"
              @click="setGenre(genre)"
            >
              {{ genre }}
            </button>
          </div>
        </div>

        <div class="grid">
          <article
            v-for="item in filteredItems"
            :key="item.id"
            class="card"
          >
            <div class="card-media">
              <img
                v-if="getPosterUrl(item)"
                class="card-media-img"
                :src="getPosterUrl(item)"
                :alt="item.title"
              />
              <div v-else class="card-media-placeholder">
                <span class="card-media-icon">🖼️</span>
              </div>
              <div class="card-media-actions">
                <button
                  type="button"
                  class="icon-button"
                  :class="{ 'icon-button--active': isWishlisted(item.id) }"
                  @click="toggleWishlist(item.id)"
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
                {{ item.year }} • {{ item.episodes }} episodes
              </p>

              <div class="rating-row">
                <div class="rating-row-top">
                  <span class="rating-label">Your rating</span>
                  <button
                    v-if="getRating(item.id) != null"
                    type="button"
                    class="clear-rating"
                    @click="clearRating(item.id)"
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
                    :class="{
                      'rating-dot--active': getRating(item.id) === n,
                    }"
                    @click="setRating(item.id, n)"
                  >
                    {{ n }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="activeTab === 'Wishlist'" class="panel">
        <div class="empty-state" v-if="wishlistItems.length === 0">
          <div class="empty-icon">✨</div>
          <h2 class="empty-title">Your wishlist is empty</h2>
          <p class="empty-text">
            Start adding content from the Explore tab!
          </p>
        </div>

        <div v-else class="grid">
          <article
            v-for="item in wishlistItems"
            :key="item.id"
            class="card"
          >
            <div class="card-media">
              <img
                v-if="getPosterUrl(item)"
                class="card-media-img"
                :src="getPosterUrl(item)"
                :alt="item.title"
              />
              <div v-else class="card-media-placeholder">
                <span class="card-media-icon">🖼️</span>
              </div>
              <div class="card-media-actions">
                <button
                  type="button"
                  class="icon-button icon-button--active"
                  @click="toggleWishlist(item.id)"
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
                {{ item.year }} • {{ item.episodes }} episodes
              </p>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="panel">
        <div class="empty-state" v-if="ratedItems.length === 0">
          <div class="empty-icon">⭐</div>
          <h2 class="empty-title">No ratings yet</h2>
          <p class="empty-text">
            Start rating your favorites!
          </p>
        </div>

        <div v-else class="grid">
          <article
            v-for="item in ratedItems"
            :key="item.id"
            class="card"
          >
            <div class="card-media">
              <img
                v-if="getPosterUrl(item)"
                class="card-media-img"
                :src="getPosterUrl(item)"
                :alt="item.title"
              />
              <div v-else class="card-media-placeholder">
                <span class="card-media-icon">🖼️</span>
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
                {{ item.year }} • {{ item.episodes }} episodes
              </p>
              <div class="rating-pill">
                <span class="rating-pill-label">Your rating</span>
                <span class="rating-pill-score">
                  {{ getRating(item.id) }}/10
                </span>
                <button
                  type="button"
                  class="clear-rating clear-rating--pill"
                  @click="clearRating(item.id)"
                >
                  Clear
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
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
}

.tab-button--active {
  background: #f9fafb;
  color: #111827;
}

.content {
  margin-top: 24px;
}

.panel {
  background: #020617;
  border-radius: 24px;
  padding: 24px;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
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

.chip--active {
  background: #f9fafb;
  color: #111827;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

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

@media (max-width: 640px) {
  .page {
    padding: 24px 16px 32px;
  }

  .panel {
    padding: 16px;
  }
}
</style>
