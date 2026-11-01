// Nạp nội dung bài học (JSON) và bài giảng (ảnh slide, âm thanh).
// Mặc định lấy từ chính trang web; đặt VITE_DATA_BASE = địa chỉ công khai của bucket R2
// (trong bucket có 2 thư mục content/ và media/) để web đọc thẳng từ R2.
const slash = url => url.replace(/\/?$/, '/')
const BASE = import.meta.env.BASE_URL
const DATA_BASE = import.meta.env.VITE_DATA_BASE ? slash(import.meta.env.VITE_DATA_BASE) : BASE
const CONTENT_BASE = `${DATA_BASE}content/`
export const MEDIA_BASE = slash(import.meta.env.VITE_MEDIA_BASE || `${DATA_BASE}media/`)

const cache = new Map()

function getJSON(url) {
  if (!cache.has(url)) {
    // no-cache: trình duyệt luôn hỏi lại máy chủ (rất nhanh nhờ ETag) nên sửa file trên R2 là thấy ngay
    const request = fetch(url, { cache: 'no-cache' })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .catch(error => { cache.delete(url); throw error })
    cache.set(url, request)
  }
  return cache.get(url)
}

export const loadIndex = () => getJSON(`${CONTENT_BASE}index.json`)
export const loadGlossary = () => getJSON(`${CONTENT_BASE}glossary.json`)
export const loadLesson = (course, id) => getJSON(`${CONTENT_BASE}${course}/${id}.json`)
export const loadDeck = (course, deck) => getJSON(`${MEDIA_BASE}${course}/${deck}/manifest.json`)
export const deckFile = (course, deck, file) => `${MEDIA_BASE}${course}/${deck}/${file}`
