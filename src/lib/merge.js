// Gộp dữ liệu học tập giữa máy này và tài khoản (Supabase). Hàm thuần, không phụ thuộc trình duyệt.
//   progress: { 'hsk1-3': ['lecture', 'flashcard', …] }  → hợp các bước đã xong
//   srs:      { 你好: { ivl, reps, due, t, card } }       → giữ bản được ôn gần nhất (t lớn hơn)
//   log:      { '2026-10-31': 25 }                       → lấy XP lớn hơn của mỗi ngày

export function mergeState(local = {}, remote = {}) {
  const progress = { ...(remote.progress ?? {}) }
  for (const [key, steps] of Object.entries(local.progress ?? {})) {
    progress[key] = [...new Set([...(progress[key] ?? []), ...steps])]
  }
  const srs = { ...(remote.srs ?? {}) }
  for (const [han, entry] of Object.entries(local.srs ?? {})) {
    const other = srs[han]
    if (!other || (entry.t ?? 0) >= (other.t ?? 0)) srs[han] = entry
  }
  const log = { ...(remote.log ?? {}) }
  for (const [day, xp] of Object.entries(local.log ?? {})) log[day] = Math.max(xp, log[day] ?? 0)
  return { progress, srs, log }
}
