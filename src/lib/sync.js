// Đăng nhập (bắt buộc) + đồng bộ tiến độ qua Worker của web (worker/index.js, dữ liệu trong Cloudflare D1).
// Bật khi build trên Cloudflare Workers (xem __LOGIN__ trong vite.config.js); chạy thử bằng pnpm dev
// hoặc trên GitHub Pages thì không có Worker → web mở thẳng, tiến độ lưu trong trình duyệt.
/* global __LOGIN__ */
export const syncEnabled = __LOGIN__

const API = `${import.meta.env.BASE_URL}api/`
const listeners = new Set()
const emit = user => listeners.forEach(fn => fn(user))

async function call(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== 'login') emit(null)   // hết phiên đăng nhập → về màn hình đăng nhập
    throw new Error(data.error ?? `Lỗi máy chủ (${res.status})`)
  }
  return data
}

export function normalizePhone(raw) {
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2)
  return /^0\d{9,10}$/.test(d) ? d : null
}

export const phoneOf = user => user?.phone ?? ''

export async function signInWithPhone(phone, password) {
  emit(await call('login', 'POST', { phone, password }))
}

export const changePassword = password => call('password', 'POST', { password })

export async function signOut() {
  await call('logout', 'POST').catch(() => {})
  emit(null)
}

export async function watchUser(onUser) {
  listeners.add(onUser)
  try { onUser(await call('me')) } catch { onUser(null) }
  return () => listeners.delete(onUser)
}

export const fetchRemote = async () => (await call('progress')).data ?? null
export const pushRemote = (_userId, state) => call('progress', 'PUT', state)

// Quản trị viên (role = 'admin'): quản lý tài khoản học viên
export const isAdmin = user => user?.role === 'admin'
export const adminApi = {
  list: () => call('admin/users'),
  create: people => call('admin/users', 'POST', { people }),
  reset: id => call(`admin/users/${id}/reset`, 'POST', {}),
  setRole: (id, role) => call(`admin/users/${id}/role`, 'POST', { role }),
  remove: id => call(`admin/users/${id}`, 'DELETE'),
}
