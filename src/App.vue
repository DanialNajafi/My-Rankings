<script setup>
import { computed, reactive, ref, onMounted, watch } from 'vue'

const TABS = ['Explore', 'Wishlist', 'Ratings']

// OMDb API key from Vite env (see .env)
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY

// Manual fixes for series where OMDb episode counts are incomplete or wrong
const EPISODE_OVERRIDES = {
  'One Piece': 1000,
  'Hell Mode': 12,
}

// AniList GraphQL endpoint (used as a better source for anime episode counts)
const ANILIST_ENDPOINT = 'https://graphql.anilist.co'

async function fetchEpisodesFromAniList(title) {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          episodes
        }
      }
    `

    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: title },
      }),
    })

    const json = await res.json()
    const episodes = json?.data?.Media?.episodes

    if (typeof episodes === 'number' && episodes > 0) {
      return episodes
    }
    return null
  } catch (e) {
    console.error('Failed to fetch episodes from AniList for', title, e)
    return null
  }
}

const activeTab = ref('Explore')
const activeGenre = ref('All')
const searchQuery = ref('')

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

// Base curated titles that are always shown when there is no search
const baseItems = reactive([
  // Movies
  {
    id: 1,
    title: 'Inception',
    year: 2010,
    episodes: 1,
    genres: ['Action', 'Sci-Fi'],
  },
  {
    id: 2,
    title: 'The Dark Knight',
    year: 2008,
    episodes: 1,
    genres: ['Action', 'Drama'],
  },
  {
    id: 3,
    title: 'Interstellar',
    year: 2014,
    episodes: 1,
    genres: ['Adventure', 'Sci-Fi'],
  },
  {
    id: 4,
    title: 'Spirited Away',
    year: 2001,
    episodes: 1,
    genres: ['Fantasy', 'Animation'],
  },
  // Live-action series
  {
    id: 5,
    title: 'Breaking Bad',
    year: 2008,
    episodes: 62,
    genres: ['Drama', 'Crime'],
  },
  {
    id: 6,
    title: 'Game of Thrones',
    year: 2011,
    episodes: 73,
    genres: ['Drama', 'Fantasy'],
  },
  {
    id: 7,
    title: 'Stranger Things',
    year: 2016,
    episodes: 34,
    genres: ['Drama', 'Supernatural'],
  },
  {
    id: 8,
    title: 'The Witcher',
    year: 2019,
    episodes: 24,
    genres: ['Action', 'Fantasy'],
  },
  // Anime series
  {
    id: 9,
    title: 'Attack on Titan',
    year: 2013,
    episodes: 87,
    genres: ['Action', 'Dark Fantasy'],
  },
  {
    id: 10,
    title: 'Fullmetal Alchemist: Brotherhood',
    year: 2009,
    episodes: 64,
    genres: ['Action', 'Adventure'],
  },
  {
    id: 11,
    title: 'Death Note',
    year: 2006,
    episodes: 37,
    genres: ['Drama', 'Supernatural'],
  },
  {
    id: 12,
    title: 'Jujutsu Kaisen',
    year: 2020,
    episodes: 47,
    genres: ['Action', 'Supernatural'],
  },
  {
    id: 13,
    title: 'My Hero Academia',
    year: 2016,
    episodes: 113,
    genres: ['Action', 'Superhero'],
  },
  {
    id: 14,
    title: 'One Piece',
    year: 1999,
    episodes: 1000,
    genres: ['Action', 'Adventure'],
  },
  {
    id: 15,
    title: 'Naruto',
    year: 2002,
    episodes: 220,
    genres: ['Action', 'Adventure'],
  },
])

// Extra titles loaded dynamically from search (only shown while searching)
const remoteItems = ref([])

// Titles that should persist (e.g. wishlisted/rated remote results)
const savedItems = ref([])

// Store fetched poster URLs keyed by item id
const posters = reactive({})

const wishlist = reactive(new Set())
const ratings = reactive({})

const LS_KEYS = {
  wishlist: 'myrankings:wishlist',
  ratings: 'myrankings:ratings',
  savedItems: 'myrankings:savedItems',
}

async function updateEpisodeCountFromOmdb(item, baseData) {
  if (!baseData) return

  // 1) Manual override wins always
  const manual = EPISODE_OVERRIDES[baseData.Title] ?? EPISODE_OVERRIDES[item.title]
  if (typeof manual === 'number' && manual > 0) {
    item.episodes = manual
    return
  }

  let best = typeof item.episodes === 'number' ? item.episodes : 0

  // 2) Try to count episodes via OMDb seasons, if we have that data
  if (OMDB_API_KEY && baseData.imdbID && baseData.totalSeasons) {
    try {
      const totalSeasons = Number.parseInt(baseData.totalSeasons, 10)
      if (!Number.isNaN(totalSeasons) && totalSeasons > 0) {
        let totalEpisodes = 0

        for (let season = 1; season <= totalSeasons; season += 1) {
          const seasonUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${baseData.imdbID}&Season=${season}`
          const seasonRes = await fetch(seasonUrl)
          const seasonData = await seasonRes.json()

          if (seasonData && Array.isArray(seasonData.Episodes)) {
            totalEpisodes += seasonData.Episodes.length
          }
        }

        if (totalEpisodes > 0) {
          best = Math.max(best, totalEpisodes)
        }
      }
    } catch (e) {
      console.error('Failed to update episodes from OMDb for', item.title, e)
    }
  }

  // 3) Fallback / enhancement: ask AniList for anime episode counts
  const aniListEpisodes = await fetchEpisodesFromAniList(item.title)
  if (typeof aniListEpisodes === 'number' && aniListEpisodes > 0) {
    best = Math.max(best, aniListEpisodes)
  }

  if (best > 0) {
    item.episodes = best
  }
}

async function fetchPosterForItem(item) {
  if (!OMDB_API_KEY) return

  try {
    const query = encodeURIComponent(item.title)
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${query}`
    const res = await fetch(url)
    const data = await res.json()

    if (data && data.Response === 'True') {
      if (data.Title) {
        item.title = data.Title
      }

      if (data.Poster && data.Poster !== 'N/A') {
        posters[item.id] = data.Poster
      }

      if (data.Type === 'series' && data.totalSeasons && data.imdbID) {
        await updateEpisodeCountFromOmdb(item, data)
      }
    }
  } catch (e) {
    console.error('Failed to fetch poster/metadata for', item.title, e)
  }
}

async function fetchAllPosters() {
  for (const item of baseItems) {
    await fetchPosterForItem(item)
  }
}

async function fetchRemoteTitleIfMissing(query) {
  if (!OMDB_API_KEY) return

  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 3) return
  const normalizedQuery = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')

  try {
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(
      trimmed,
    )}`
    const res = await fetch(url)
    const data = await res.json()

    if (data && data.Response === 'True' && Array.isArray(data.Search)) {
      // Start fresh remote results for this search
      remoteItems.value = []

      // Find a base for new numeric ids
      const existingIds = [...baseItems, ...remoteItems.value].map(
        (i) => Number(i.id) || 0,
      )
      let nextId =
        existingIds.length > 0
          ? Math.max(...existingIds.filter((n) => !Number.isNaN(n))) + 1
          : 1

      for (const result of data.Search) {
        const title = result.Title
        if (!title) continue

        const normalizedTitle = title
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')

        // Only accept titles that are very close to the query:
        // Require the normalized title to start with the normalized query
        // or vice versa (so "naruto" also matches "naruto shippuden")
        const isCloseMatch =
          normalizedTitle.startsWith(normalizedQuery) ||
          normalizedQuery.startsWith(normalizedTitle)
        if (!isCloseMatch) continue

        const alreadyExists = baseItems.some(
          (item) => item.title.toLowerCase() === title.toLowerCase(),
        )
        if (alreadyExists) continue

        const alreadySaved = savedItems.value.some(
          (item) => item.title.toLowerCase() === title.toLowerCase(),
        )
        if (alreadySaved) continue

        const year = result.Year
        const newItem = {
          id: nextId,
          title,
          year: year ? Number.parseInt(year, 10) || null : null,
          episodes: 1,
          genres: [],
        }

        nextId += 1
        remoteItems.value.push(newItem)
        await fetchPosterForItem(newItem)
      }
    }
  } catch (e) {
    console.error('Failed to fetch remote titles for search', query, e)
  }
}

function getPosterUrl(item) {
  return posters[item.id] ?? null
}

onMounted(() => {
  fetchAllPosters()

  // Restore persisted state
  try {
    const rawWishlist = localStorage.getItem(LS_KEYS.wishlist)
    const rawRatings = localStorage.getItem(LS_KEYS.ratings)
    const rawSavedItems = localStorage.getItem(LS_KEYS.savedItems)

    const wishlistIds = rawWishlist ? JSON.parse(rawWishlist) : []
    if (Array.isArray(wishlistIds)) {
      wishlist.clear()
      for (const id of wishlistIds) wishlist.add(id)
    }

    const parsedRatings = rawRatings ? JSON.parse(rawRatings) : null
    if (parsedRatings && typeof parsedRatings === 'object') {
      for (const key of Object.keys(ratings)) delete ratings[key]
      for (const [id, score] of Object.entries(parsedRatings)) {
        ratings[id] = score
      }
    }

    const parsedSaved = rawSavedItems ? JSON.parse(rawSavedItems) : []
    if (Array.isArray(parsedSaved)) {
      savedItems.value = parsedSaved
      for (const item of savedItems.value) {
        fetchPosterForItem(item)
      }
    }
  } catch (e) {
    console.error('Failed to restore from localStorage', e)
  }
})

watch(
  () => searchQuery.value,
  (value) => {
    if (!value) {
      // Reset Explore view when search is cleared
      activeGenre.value = 'All'
      remoteItems.value = []
      return
    }
    fetchRemoteTitleIfMissing(value)
  },
)

// Persist wishlist/ratings/savedItems
watch(
  () => Array.from(wishlist).slice().sort((a, b) => Number(a) - Number(b)),
  (ids) => {
    try {
      localStorage.setItem(LS_KEYS.wishlist, JSON.stringify(ids))
    } catch (e) {
      console.error('Failed to persist wishlist', e)
    }
  },
  { deep: false },
)

watch(
  ratings,
  (value) => {
    try {
      localStorage.setItem(LS_KEYS.ratings, JSON.stringify(value))
    } catch (e) {
      console.error('Failed to persist ratings', e)
    }
  },
  { deep: true },
)

watch(
  () => savedItems.value,
  (value) => {
    try {
      localStorage.setItem(LS_KEYS.savedItems, JSON.stringify(value))
    } catch (e) {
      console.error('Failed to persist saved items', e)
    }
  },
  { deep: true },
)

const filteredItems = computed(() => {
  const genre = activeGenre.value
  const query = searchQuery.value.trim().toLowerCase()

  // When there is no search query, show only the curated base items
  if (!query) {
    return genre === 'All'
      ? baseItems
      : baseItems.filter((item) => item.genres.includes(genre))
  }

  // When searching, include both base and remote items
  const result =
    genre === 'All'
      ? allItems.value
      : allItems.value.filter((item) => item.genres.includes(genre))

  return result.filter((item) =>
    item.title.toLowerCase().includes(query),
  )
})

const allItems = computed(() => [...baseItems, ...savedItems.value, ...remoteItems.value])

const wishlistItems = computed(() =>
  allItems.value.filter((item) => wishlist.has(item.id)),
)

const ratedItems = computed(() =>
  allItems.value.filter((item) => ratings[item.id] != null),
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
    const item = allItems.value.find((i) => i.id === id)
    if (item) {
      const isBase = baseItems.some((b) => b.id === id)
      const isSaved = savedItems.value.some((s) => s.id === id)
      if (!isBase && !isSaved) {
        savedItems.value.push({ ...item })
      }
    }
    wishlist.add(id)
  }
}

function setRating(id, score) {
  const item = allItems.value.find((i) => i.id === id)
  if (item) {
    const isBase = baseItems.some((b) => b.id === id)
    const isSaved = savedItems.value.some((s) => s.id === id)
    if (!isBase && !isSaved) {
      savedItems.value.push({ ...item })
    }
  }
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
          <div class="panel-header-controls">
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
            <input
              v-model="searchQuery"
              type="search"
              class="search-input"
              placeholder="Search titles..."
            />
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
