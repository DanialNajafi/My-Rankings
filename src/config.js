// OMDb API key from Vite env (see .env)
export const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY

// Manual fixes for series where OMDb episode counts are incomplete or wrong
export const EPISODE_OVERRIDES = {
  'Hell Mode': 12,
}
