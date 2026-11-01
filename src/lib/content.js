// Nạp nội dung bài học (JSON) và bài giảng (ảnh slide, âm thanh). Trong bucket R2 có 2 thư mục content/ và media/.
//   - Bật đăng nhập (build trên Cloudflare Workers): lấy qua /data/ – Worker chỉ gửi cho người đã đăng nhập.
//   - Không đăng nhập: lấy từ chính trang web, hoặc thẳng từ R2 nếu đặt VITE_DATA_BASE = địa chỉ công khai của bucket.
/* global __LOGIN__ */
const slash = url => url.replace(/\/?$/, '/')
const BASE = import.meta.env.BASE_URL
const DATA_BASE = __LOGIN__ ? `${BASE}data/` : import.meta.env.VITE_DATA_BASE ? slash(import.meta.env.VITE_DATA_BASE) : BASE
const CONTENT_BASE = `${DATA_BASE}content/`
export const MEDIA_BASE = __LOGIN__ ? `${DATA_BASE}media/` : slash(import.meta.env.VITE_MEDIA_BASE || `${DATA_BASE}media/`)

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
