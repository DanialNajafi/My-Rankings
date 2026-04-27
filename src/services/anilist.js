const ANILIST_ENDPOINT = 'https://graphql.anilist.co'

export async function fetchAnimeMetaFromAniList(title) {
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

export async function loadTrendingAnimeFromAniList(limit = 12) {
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

    return mediaList
      .map((media) => {
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
      })
      .filter(Boolean)
  } catch (e) {
    console.error('Failed to load trending anime from AniList', e)
    return []
  }
}

export async function searchAniListAnime(trimmed, perPage = 8) {
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
    body: JSON.stringify({ query: aniQuery, variables: { search: trimmed, perPage } }),
  })
  const aniJson = await aniRes.json()
  return aniJson?.data?.Page?.media
}
