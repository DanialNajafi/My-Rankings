import { computed, reactive, ref, onMounted, watch } from 'vue'
import { EPISODE_OVERRIDES, OMDB_API_KEY } from '../config.js'
import { GENRES, LS_KEYS, TABS } from '../constants.js'
import {
  fetchAnimeMetaFromAniList,
  loadTrendingAnimeFromAniList,
  searchAniListAnime,
} from '../services/anilist.js'
import { loadTopMoviesFromApple } from '../services/appleRss.js'
import {
  omdbFetchByItem,
  omdbSearchTitles,
  updateEpisodeCountFromOmdb,
} from '../services/omdb.js'
import {
  fetchSeriesEpisodeCountFromTvmaze,
  loadTrendingSeriesFromTvmaze,
} from '../services/tvmaze.js'

export function useRankings() {
  const activeTab = ref('Explore')
  const activeGenre = ref('All')
  const searchQuery = ref('')

  const baseItems = reactive([])
  const remoteItems = ref([])
  const savedItems = ref([])
  const posters = reactive({})
  const failedPosterUrls = reactive({})
  const posterRefreshInFlight = reactive({})
  const wishlist = reactive(new Set())
  const ratings = reactive({})

  function hasPosterUrlFailed(id, url) {
    if (id == null || !url) return false
    return Boolean(failedPosterUrls[id]?.[url])
  }

  function markPosterUrlFailed(id, url) {
    if (id == null || !url) return
    if (!failedPosterUrls[id]) failedPosterUrls[id] = {}
    failedPosterUrls[id][url] = true
  }

  function setPosterUrlIfValid(id, url) {
    if (id == null || !url) return false
    if (hasPosterUrlFailed(id, url)) return false
    posters[id] = url
    return true
  }

  function getNextId() {
    const all = [...baseItems, ...savedItems.value]
    const ids = all
      .map((i) => Number(i.id) || 0)
      .filter((n) => !Number.isNaN(n) && n > 0)
    return ids.length > 0 ? Math.max(...ids) + 1 : 1
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
          setPosterUrlIfValid(id, item.posterUrl)
        } else {
          fetchPosterForItem(withId)
        }
      }
    } catch (e) {
      console.error('Failed to load trending base items', e)
    }
  }

  async function fetchPosterForItem(item) {
    if (item?.source === 'anilist') {
      const meta = await fetchAnimeMetaFromAniList(item.title)
      if (!meta) return

      if (meta.title) item.title = meta.title
      if (typeof meta.year === 'number') item.year = meta.year
      if (typeof meta.episodes === 'number') item.episodes = meta.episodes
      if (Array.isArray(meta.genres) && meta.genres.length > 0) item.genres = meta.genres
      if (meta.coverUrl) setPosterUrlIfValid(item.id, meta.coverUrl)
      if (meta.anilistId) item.anilistId = meta.anilistId
      return
    }

    if (!OMDB_API_KEY) return

    try {
      const data = await omdbFetchByItem(item, OMDB_API_KEY)

      if (data && data.Response === 'True') {
        if (data.Title) {
          item.title = data.Title
        }

        if (data.Poster && data.Poster !== 'N/A') {
          setPosterUrlIfValid(item.id, data.Poster)
        }

        if (data.imdbID) item.imdbID = data.imdbID
        if (data.Type) item.omdbType = data.Type
        if (data.Type) item.kind = data.Type

        if (data.Type === 'series' && data.totalSeasons && data.imdbID) {
          const tvmazeCount = await fetchSeriesEpisodeCountFromTvmaze(item)
          if (typeof tvmazeCount === 'number' && tvmazeCount > 0) {
            item.episodes = tvmazeCount
          } else {
            await updateEpisodeCountFromOmdb(item, data, OMDB_API_KEY, EPISODE_OVERRIDES)
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch OMDb metadata for', item.title, e)
    }
  }

  async function fetchRemoteTitleIfMissing(query) {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 3) return
    const normalizedQuery = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')

    try {
      remoteItems.value = []

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

      try {
        const mediaList = await searchAniListAnime(trimmed, 8)
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
            if (media?.coverImage?.large) {
              setPosterUrlIfValid(newItem.id, media.coverImage.large)
            }
          }
        }
      } catch (e) {
        console.error('AniList search failed for', trimmed, e)
      }

      if (OMDB_API_KEY) {
        const data = await omdbSearchTitles(trimmed, OMDB_API_KEY)

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
    if (!item) return null
    const posterUrl = posters[item.id] ?? null
    if (!posterUrl) return null
    return hasPosterUrlFailed(item.id, posterUrl) ? null : posterUrl
  }

  async function tryRefreshPosterFromAniList(item) {
    const meta = await fetchAnimeMetaFromAniList(item.title)
    if (!meta) return false
    if (meta.coverUrl && setPosterUrlIfValid(item.id, meta.coverUrl)) return true
    return false
  }

  async function tryRefreshPosterFromOmdb(item) {
    if (!OMDB_API_KEY) return false
    const data = await omdbFetchByItem(item, OMDB_API_KEY)
    if (!data || data.Response !== 'True') return false
    if (data.Poster && data.Poster !== 'N/A' && setPosterUrlIfValid(item.id, data.Poster)) return true
    return false
  }

  async function handlePosterError(item, failedUrl) {
    if (!item || item.id == null) return
    if (failedUrl) {
      markPosterUrlFailed(item.id, failedUrl)
      if (posters[item.id] === failedUrl) delete posters[item.id]
    }

    if (posterRefreshInFlight[item.id]) return
    posterRefreshInFlight[item.id] = true

    try {
      const isAnime = item?.source === 'anilist' || item?.kind === 'anime'
      if (isAnime) {
        if (await tryRefreshPosterFromAniList(item)) return
        await tryRefreshPosterFromOmdb(item)
        return
      }

      if (await tryRefreshPosterFromOmdb(item)) return
      await tryRefreshPosterFromAniList(item)
    } catch (e) {
      console.error('Failed to refresh poster for', item?.title, e)
    } finally {
      posterRefreshInFlight[item.id] = false
    }
  }

  onMounted(() => {
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

    loadTrendingBaseItems()
  })

  watch(
    () => searchQuery.value.trim(),
    (value) => {
      if (!value) {
        activeGenre.value = 'All'
        remoteItems.value = []
        return
      }
      fetchRemoteTitleIfMissing(value)
    },
  )

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

    if (!query) {
      return genre === 'All'
        ? baseItems
        : baseItems.filter((item) => item.genres.includes(genre))
    }

    const result =
      genre === 'All'
        ? allItems.value
        : allItems.value.filter((item) => item.genres.includes(genre))

    return result.filter((item) => item.title.toLowerCase().includes(query))
  })

  const allItems = computed(() => [...baseItems, ...savedItems.value, ...remoteItems.value])

  const wishlistItems = computed(() => allItems.value.filter((item) => wishlist.has(item.id)))

  const ratedItems = computed(() => allItems.value.filter((item) => ratings[item.id] != null))

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

  return {
    TABS,
    genres: GENRES,
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
  }
}
