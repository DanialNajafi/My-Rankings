<script setup>
import { computed, reactive, ref, onMounted, watch } from 'vue'

const TABS = ['Explore', 'Wishlist', 'Ratings']

// OMDb API key from Vite env (see .env)
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY

// Manual fixes for series where OMDb episode counts are incomplete or wrong
const EPISODE_OVERRIDES = {
  'Hell Mode': 12,
}

// AniList GraphQL endpoint (used as a better source for anime episode counts)
const ANILIST_ENDPOINT = 'https://graphql.anilist.co'
const TVMAZE_BASE = 'https://api.tvmaze.com'

async function fetchAnimeMetaFromAniList(title) {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          episodes
          nextAiringEpisode {
            episode
          }
          genres
          startDate {
            year
          }
          coverImage {
            large
          }
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
    const media = json?.data?.Media
    if (!media) return null

    const displayTitle =
      media.title?.english || media.title?.romaji || media.title?.native || null

    const computedEpisodes =
      typeof media.episodes === 'number' && media.episodes > 0
        ? media.episodes
        : typeof media.nextAiringEpisode?.episode === 'number' &&
            media.nextAiringEpisode.episode > 1
          ? media.nextAiringEpisode.episode - 1
          : null

    return {
      anilistId: media.id ?? null,
      title: displayTitle,
      year: media.startDate?.year ?? null,
      episodes: computedEpisodes,
      genres: Array.isArray(media.genres) ? media.genres : [],
      coverUrl: media.coverImage?.large ?? null,
    }
  } catch (e) {
    console.error('Failed to fetch anime meta from AniList for', title, e)
    return null
  }
}

async function fetchSeriesEpisodeCountFromTvmaze(item) {
  try {
    if (!item) return null

    let tvmazeId = item.tvmazeId ?? null

    if (!tvmazeId) {
      if (!item.imdbID) return null
      const lookupRes = await fetch(
        `${TVMAZE_BASE}/lookup/shows?imdb=${encodeURIComponent(item.imdbID)}`,
      )
      if (!lookupRes.ok) return null
      const show = await lookupRes.json()
      tvmazeId = show?.id ?? null
      if (tvmazeId) item.tvmazeId = tvmazeId
    }

    if (!tvmazeId) return null
    const epsRes = await fetch(`${TVMAZE_BASE}/shows/${tvmazeId}/episodes`)
    if (!epsRes.ok) return null
    const eps = await epsRes.json()

    if (Array.isArray(eps) && eps.length > 0) {
      return eps.length
    }
    return null
  } catch (e) {
    console.error('Failed to fetch TVMaze episodes for', item?.title, e)
    return null
  }
}

async function loadTrendingAnimeFromAniList(limit = 12) {
  try {
    const query = `
      query ($perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(sort: TRENDING_DESC, type: ANIME) {
            id
            title { romaji english native }
            episodes
            nextAiringEpisode { episode }
            genres
            startDate { year }
            coverImage { large }
          }
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
        variables: { perPage: limit },
      }),
    })

    const json = await res.json()
    const mediaList = json?.data?.Page?.media
    if (!Array.isArray(mediaList)) return []

    return mediaList.map((media) => {
      const title =
        media?.title?.english || media?.title?.romaji || media?.title?.native
      if (!title) return null

      const episodes =
        typeof media?.episodes === 'number' && media.episodes > 0
          ? media.episodes
          : typeof media?.nextAiringEpisode?.episode === 'number' &&
              media.nextAiringEpisode.episode > 1
            ? media.nextAiringEpisode.episode - 1
            : null

      return {
        title,
        year: media?.startDate?.year ?? null,
        episodes,
        genres: Array.isArray(media?.genres) ? media.genres : [],
        kind: 'anime',
        source: 'anilist',
        anilistId: media?.id ?? null,
        posterUrl: media?.coverImage?.large ?? null,
      }
    }).filter(Boolean)
  } catch (e) {
    console.error('Failed to load trending anime from AniList', e)
    return []
  }
}

async function loadTrendingSeriesFromTvmaze(limit = 12) {
  try {
    const res = await fetch(`${TVMAZE_BASE}/shows?page=0`)
    if (!res.ok) return []
    const shows = await res.json()
    if (!Array.isArray(shows)) return []

    const sorted = shows
      .slice()
      .sort((a, b) => (b?.weight || 0) - (a?.weight || 0))
      .slice(0, limit)

    return sorted.map((show) => {
      const title = show?.name
      if (!title) return null

      const premiered = show?.premiered
      const year = premiered ? Number.parseInt(premiered.slice(0, 4), 10) || null : null

      const genres = Array.isArray(show?.genres) ? show.genres : []

      const posterUrl = show?.image?.original || show?.image?.medium || null

      return {
        title,
        year,
        episodes: null,
        genres,
        kind: 'series',
        source: 'tvmaze',
        tvmazeId: show?.id ?? null,
        imdbID: show?.externals?.imdb ?? null,
        posterUrl,
      }
    }).filter(Boolean)
  } catch (e) {
    console.error('Failed to load trending series from TVMaze', e)
    return []
  }
}

async function loadTopMoviesFromApple(limit = 12, country = 'us') {
  try {
    const res = await fetch(
      `https://rss.itunes.apple.com/api/v1/${country}/movies/top-movies/${limit}/explicit.json`,
    )
    if (!res.ok) return []
    const json = await res.json()
    const results = json?.feed?.results
    if (!Array.isArray(results)) return []

    return results.map((entry) => {
      const title = entry?.name
      if (!title) return null

      const releaseDate = entry?.releaseDate
      const year = releaseDate
        ? Number.parseInt(releaseDate.slice(0, 4), 10) || null
        : null

      const genres = Array.isArray(entry?.genres)
        ? entry.genres.map((g) => g.name).filter(Boolean)
        : []

      let posterUrl = entry?.artworkUrl100 ?? null
      if (posterUrl) {
        // Use a higher resolution if available via URL pattern
        posterUrl = posterUrl.replace('100x100bb', '500x500bb')
      }

      return {
        title,
        year,
        episodes: 1,
        genres,
        kind: 'movie',
        source: 'apple',
        posterUrl,
      }
    }).filter(Boolean)
  } catch (e) {
    console.error('Failed to load top movies from Apple RSS', e)
    return []
  }
}

async function loadTrendingBaseItems() {
  try {
    const [anime, series, movies] = await Promise.all([
      loadTrendingAnimeFromAniList(12),
      loadTrendingSeriesFromTvmaze(12),
      loadTopMoviesFromApple(12, 'us'),
    ])

    const merged = [...anime, ...series, ...movies]
    const seen = new Set()

    // Clear any previous runtime base items (but keep array reactive)
    baseItems.splice(0, baseItems.length)

    for (const item of merged) {
      const norm = (item.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      if (!norm || seen.has(norm)) continue
      seen.add(norm)

      const id = getNextId()
      const withId = { ...item, id }
      baseItems.push(withId)

      if (item.posterUrl) {
        posters[id] = item.posterUrl
      } else {
        // As a fallback, let fetchPosterForItem try to enrich later
        fetchPosterForItem(withId)
      }
    }
  } catch (e) {
    console.error('Failed to load trending base items', e)
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

// Base curated titles for Explore (filled at runtime from trending APIs)
const baseItems = reactive([])

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

function getNextId() {
  const all = [...baseItems, ...savedItems.value]
  const ids = all
    .map((i) => Number(i.id) || 0)
    .filter((n) => !Number.isNaN(n) && n > 0)
  return ids.length > 0 ? Math.max(...ids) + 1 : 1
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

  if (best > 0) {
    item.episodes = best
  }
}

async function fetchPosterForItem(item) {
  // If the item is anime, always use AniList for metadata + cover
  if (item?.source === 'anilist') {
    const meta = await fetchAnimeMetaFromAniList(item.title)
    if (!meta) return

    if (meta.title) item.title = meta.title
    if (typeof meta.year === 'number') item.year = meta.year
    if (typeof meta.episodes === 'number') item.episodes = meta.episodes
    if (Array.isArray(meta.genres) && meta.genres.length > 0) item.genres = meta.genres
    if (meta.coverUrl) posters[item.id] = meta.coverUrl
    if (meta.anilistId) item.anilistId = meta.anilistId
    return
  }

  // Otherwise (series/movies), use OMDb
  if (!OMDB_API_KEY) return

  try {
    const url =
      item?.imdbID
        ? `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(item.imdbID)}`
        : `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(item.title)}`

    const res = await fetch(url)
    const data = await res.json()

    if (data && data.Response === 'True') {
      if (data.Title) {
        item.title = data.Title
      }

      if (data.Poster && data.Poster !== 'N/A') {
        posters[item.id] = data.Poster
      }

      if (data.imdbID) item.imdbID = data.imdbID
      if (data.Type) item.omdbType = data.Type
      if (data.Type) item.kind = data.Type

      if (data.Type === 'series' && data.totalSeasons && data.imdbID) {
        const tvmazeCount = await fetchSeriesEpisodeCountFromTvmaze(item)
        if (typeof tvmazeCount === 'number' && tvmazeCount > 0) {
          item.episodes = tvmazeCount
        } else {
          await updateEpisodeCountFromOmdb(item, data)
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch OMDb metadata for', item.title, e)
  }
}

async function fetchAllPosters() {
  // Kept for backward compatibility; now handled by trending loaders.
  return
}

async function fetchRemoteTitleIfMissing(query) {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 3) return
  const normalizedQuery = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')

  try {
    // Start fresh remote results for this search
    remoteItems.value = []

    // Find a base for new numeric ids
    const existingIds = [...baseItems, ...savedItems.value].map((i) => Number(i.id) || 0)
    let nextId =
      existingIds.length > 0
        ? Math.max(...existingIds.filter((n) => !Number.isNaN(n))) + 1
        : 1

    const normalizedStartsWith = (title) => {
      const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '')
      return (
        normalizedTitle.startsWith(normalizedQuery) ||
        normalizedQuery.startsWith(normalizedTitle)
      )
    }

    // 1) Anime: always search via AniList
    try {
      const aniQuery = `
        query ($search: String, $perPage: Int) {
          Page(page: 1, perPage: $perPage) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              title { romaji english native }
              episodes
              nextAiringEpisode { episode }
              genres
              startDate { year }
              coverImage { large }
            }
          }
        }
      `
      const aniRes = await fetch(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: aniQuery, variables: { search: trimmed, perPage: 8 } }),
      })
      const aniJson = await aniRes.json()
      const mediaList = aniJson?.data?.Page?.media
      if (Array.isArray(mediaList)) {
        for (const media of mediaList) {
          const title =
            media?.title?.english || media?.title?.romaji || media?.title?.native
          if (!title) continue
          if (!normalizedStartsWith(title)) continue

          const alreadyExists =
            baseItems.some((i) => i.title.toLowerCase() === title.toLowerCase()) ||
            savedItems.value.some((i) => i.title.toLowerCase() === title.toLowerCase())
          if (alreadyExists) continue

          const newItem = {
            id: nextId,
            title,
            year: media?.startDate?.year ?? null,
            episodes:
              typeof media?.episodes === 'number' && media.episodes > 0
                ? media.episodes
                : typeof media?.nextAiringEpisode?.episode === 'number' &&
                    media.nextAiringEpisode.episode > 1
                  ? media.nextAiringEpisode.episode - 1
                  : 1,
            genres: Array.isArray(media?.genres) ? media.genres : [],
            source: 'anilist',
            kind: 'anime',
            anilistId: media?.id ?? null,
          }
          nextId += 1
          remoteItems.value.push(newItem)
          if (media?.coverImage?.large) posters[newItem.id] = media.coverImage.large
        }
      }
    } catch (e) {
      console.error('AniList search failed for', trimmed, e)
    }

    // 2) Series/Movies: search via OMDb (no anime here)
    if (OMDB_API_KEY) {
      const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(
        trimmed,
      )}`
      const res = await fetch(url)
      const data = await res.json()

      if (data && data.Response === 'True' && Array.isArray(data.Search)) {
        for (const result of data.Search) {
          if (result?.Type !== 'series' && result?.Type !== 'movie') continue

          const title = result.Title
          if (!title) continue
          if (!normalizedStartsWith(title)) continue

          const alreadyExists =
            baseItems.some((i) => i.title.toLowerCase() === title.toLowerCase()) ||
            savedItems.value.some((i) => i.title.toLowerCase() === title.toLowerCase())
          if (alreadyExists) continue

          const newItem = {
            id: nextId,
            title,
            year: result.Year ? Number.parseInt(result.Year, 10) || null : null,
            episodes: 1,
            genres: [],
            source: 'omdb',
            kind: result.Type ?? null,
            imdbID: result.imdbID ?? null,
            omdbType: result.Type ?? null,
          }

          nextId += 1
          remoteItems.value.push(newItem)
          await fetchPosterForItem(newItem)
        }
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
      savedItems.value = parsedSaved.map((item) => ({
        ...item,
        source: item?.source ?? 'omdb',
        kind:
          item?.kind ??
          item?.omdbType ??
          (item?.source === 'anilist' ? 'anime' : null),
      }))
      for (const item of savedItems.value) {
        fetchPosterForItem(item)
      }
    }
  } catch (e) {
    console.error('Failed to restore from localStorage', e)
  }

  // Load mixed trending list for Explore
  loadTrendingBaseItems()
})

watch(
  () => searchQuery.value.trim(),
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

function getMetaLine(item) {
  const year = item?.year ?? '?'
  const kind = item?.kind ?? item?.omdbType ?? 'series'

  if (kind === 'movie') return `${year} • Movie`

  const count =
    typeof item?.episodes === 'number' && item.episodes > 0 ? item.episodes : '?'
  return `${year} • ${count} episodes`
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
              v-model.trim="searchQuery"
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
                {{ getMetaLine(item) }}
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
                {{ getMetaLine(item) }}
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
                {{ getMetaLine(item) }}
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
