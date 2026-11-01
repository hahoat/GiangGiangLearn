const toneMarks = [
  ['ā', 'ē', 'ī', 'ō', 'ū', 'ǖ', 'Ā', 'Ē'],
  ['á', 'é', 'í', 'ó', 'ú', 'ǘ', 'Á', 'É'],
  ['ǎ', 'ě', 'ǐ', 'ǒ', 'ǔ', 'ǚ', 'Ǎ', 'Ě'],
  ['à', 'è', 'ì', 'ò', 'ù', 'ǜ', 'À', 'È']
]

// Thanh điệu của một âm tiết pinyin: 1–4, hoặc 5 là thanh nhẹ.
export function toneOf(syllable) {
  for (let i = 0; i < 4; i++) if (toneMarks[i].some(m => syllable.includes(m))) return i + 1
  return 5
}

export const isHan = ch => /[㐀-鿿]/.test(ch)

let dictionary = new Map()
let longest = 1

// Nạp từ điển (public/content/glossary.json) – gọi một lần khi web khởi động.
export function setGlossary(entries) {
  dictionary = new Map(entries.map(entry => [entry.han, entry]))
  longest = Math.max(1, ...entries.map(entry => [...entry.han].length))
}

export const lookup = han => dictionary.get(han)

// Ghép từng chữ Hán với âm tiết pinyin tương ứng, nếu số lượng khớp nhau.
export function pairSyllables(han, py = '') {
  const chars = [...han]
  const syllables = py.split(/\s+/).filter(Boolean)
  const hanCount = chars.filter(isHan).length
  // Âm cuốn lưỡi: 面条儿 = miàn tiáor → 儿 không có âm tiết riêng
  const erhua = chars.at(-1) === '儿' && syllables.length === hanCount - 1 && /r$/.test(syllables.at(-1) ?? '')
  if (syllables.length !== hanCount && !erhua) return chars.map(ch => ({ ch, py: '', tone: 0 }))
  let k = 0
  return chars.map((ch, i) => {
    if (!isHan(ch)) return { ch, py: '', tone: 0 }
    if (erhua && i === chars.length - 1) return { ch, py: '', tone: toneOf(syllables.at(-1)) }
    const s = syllables[k++]
    return { ch, py: s, tone: toneOf(s) }
  })
}

// Tách câu thành các từ có trong từ điển (khớp dài nhất trước).
export function segment(text) {
  const chars = [...text]
  const tokens = []
  for (let i = 0; i < chars.length;) {
    let found = null
    for (let len = Math.min(longest, chars.length - i); len > 0 && !found; len--) {
      const entry = dictionary.get(chars.slice(i, i + len).join(''))
      if (entry) found = entry
    }
    if (found) { tokens.push({ text: found.han, entry: found }); i += [...found.han].length }
    else { tokens.push({ text: chars[i], entry: null }); i++ }
  }
  return tokens
}

/* ---------- Lặp lại ngắt quãng (SRS) ---------- */

const DAY = 24 * 60 * 60 * 1000

export const grades = [
  { id: 'again', label: 'Chưa nhớ', key: '1' },
  { id: 'hard', label: 'Không chắc', key: '2' },
  { id: 'good', label: 'Đã nhớ', key: '3' }
]

// Trả về trạng thái mới của thẻ sau khi người học tự đánh giá.
export function schedule(card = { ivl: 0, reps: 0 }, grade, now = Date.now()) {
  const ivl = card.ivl || 0
  if (grade === 'again') return { ivl: 0, reps: 0, due: now + 60 * 1000 }
  const next = grade === 'hard' ? Math.max(1, Math.round(ivl * 1.2))
    : grade === 'good' ? (ivl ? Math.round(ivl * 2.5) : 1)
    : (ivl ? Math.round(ivl * 3.5) : 4)
  return { ivl: next, reps: (card.reps || 0) + 1, due: now + next * DAY }
}

export function intervalLabel(card, grade) {
  const { ivl } = schedule(card, grade)
  return ivl === 0 ? '1 phút' : ivl === 1 ? '1 ngày' : ivl < 30 ? `${ivl} ngày` : `${Math.round(ivl / 30)} tháng`
}

export const isDue = (card, now = Date.now()) => !card || card.due <= now

/* ---------- Mục tiêu ngày & chuỗi ngày học ---------- */

export const dayKey = (date = new Date()) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function streakOf(log, today = new Date()) {
  const d = new Date(today)
  if (!log[dayKey(d)]) d.setDate(d.getDate() - 1)
  let streak = 0
  while (log[dayKey(d)] > 0) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}
