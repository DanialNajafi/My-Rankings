const TVMAZE_BASE = 'https://api.tvmaze.com'

export async function fetchSeriesEpisodeCountFromTvmaze(item) {
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

export async function loadTrendingSeriesFromTvmaze(limit = 12) {
  try {
    const res = await fetch(`${TVMAZE_BASE}/shows?page=0`)
    if (!res.ok) return []
    const shows = await res.json()
    if (!Array.isArray(shows)) return []

    const sorted = shows
      .slice()
      .sort((a, b) => (b?.weight || 0) - (a?.weight || 0))
      .slice(0, limit)

    return sorted
      .map((show) => {
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
      })
      .filter(Boolean)
  } catch (e) {
    console.error('Failed to load trending series from TVMaze', e)
    return []
  }
}
