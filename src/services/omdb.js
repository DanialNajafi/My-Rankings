export async function updateEpisodeCountFromOmdb(item, baseData, apiKey, episodeOverrides) {
  if (!baseData) return

  const manual = episodeOverrides[baseData.Title] ?? episodeOverrides[item.title]
  if (typeof manual === 'number' && manual > 0) {
    item.episodes = manual
    return
  }

  let best = typeof item.episodes === 'number' ? item.episodes : 0

  if (apiKey && baseData.imdbID && baseData.totalSeasons) {
    try {
      const totalSeasons = Number.parseInt(baseData.totalSeasons, 10)
      if (!Number.isNaN(totalSeasons) && totalSeasons > 0) {
        let totalEpisodes = 0

        for (let season = 1; season <= totalSeasons; season += 1) {
          const seasonUrl = `https://www.omdbapi.com/?apikey=${apiKey}&i=${baseData.imdbID}&Season=${season}`
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

export async function omdbSearchTitles(trimmed, apiKey) {
  if (!apiKey) return null
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(trimmed)}`
  const res = await fetch(url)
  return res.json()
}

export async function omdbFetchByItem(item, apiKey) {
  if (!apiKey) return null
  const url = item?.imdbID
    ? `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(item.imdbID)}`
    : `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(item.title)}`

  const res = await fetch(url)
  return res.json()
}
