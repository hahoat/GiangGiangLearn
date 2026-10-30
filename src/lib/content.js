// Nạp nội dung bài học (JSON trên GitHub Pages) và bài giảng (ảnh slide trên GitHub Pages hoặc CDN).
const BASE = import.meta.env.BASE_URL
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE || `${BASE}media/`).replace(/\/?$/, '/')

const cache = new Map()

function getJSON(url) {
  if (!cache.has(url)) {
    const request = fetch(url)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .catch(error => { cache.delete(url); throw error })
    cache.set(url, request)
  }
  return cache.get(url)
}

export const loadIndex = () => getJSON(`${BASE}content/index.json`)
export const loadGlossary = () => getJSON(`${BASE}content/glossary.json`)
export const loadLesson = (course, id) => getJSON(`${BASE}content/${course}/${id}.json`)
export const loadDeck = (course, deck) => getJSON(`${MEDIA_BASE}${course}/${deck}/manifest.json`)
export const deckFile = (course, deck, file) => `${MEDIA_BASE}${course}/${deck}/${file}`
