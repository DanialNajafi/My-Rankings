export async function loadTopMoviesFromApple(limit = 12, country = 'us') {
  try {
    const res = await fetch(
      `https://rss.itunes.apple.com/api/v1/${country}/movies/top-movies/${limit}/explicit.json`,
    )
    if (!res.ok) return []
    const json = await res.json()
    const results = json?.feed?.results
    if (!Array.isArray(results)) return []

    return results
      .map((entry) => {
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
      })
      .filter(Boolean)
  } catch (e) {
    console.error('Failed to load top movies from Apple RSS', e)
    return []
  }
}
