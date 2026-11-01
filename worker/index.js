// Cloudflare Worker của web Giang Giang.
//   /api/*   đăng nhập bằng số điện thoại + mật khẩu, đổi mật khẩu, lưu tiến độ (cơ sở dữ liệu D1, binding DB)
//   /api/admin/*  quản trị viên (role = 'admin') tạo / đặt lại mật khẩu / xóa tài khoản học viên
//   /data/*  bài học + slide + âm thanh trong bucket R2 (binding MEDIA) – chỉ gửi cho người đã đăng nhập
//   còn lại  file tĩnh của web trong dist/ (binding ASSETS)
// Bảng trong D1 được tự tạo ở lần chạy đầu (xem SCHEMA). Tài khoản do quản trị viên tạo trên web (trang Quản lý
// học viên) hoặc bằng scripts/tao_tai_khoan.py.

const COOKIE = 'gg_session'
const SESSION_DAYS = 30
const PBKDF2_ITER = 100000          // phải giống scripts/tao_tai_khoan.py
const DEFAULT_PASSWORD = '12345678'
const MAX_FAILS = 10                // sai mật khẩu 10 lần liên tiếp → khóa 15 phút
const LOCK_MS = 15 * 60 * 1000

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     phone TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL DEFAULT '',
     password TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'student',
     fails INTEGER NOT NULL DEFAULT 0,
     locked_until INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS progress (
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     data TEXT NOT NULL,
     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
]

const enc = new TextEncoder()
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const b64url = bytes => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = s => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })
const fail = (error, status) => json({ error }, status)

export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2)
  return /^0\d{9,10}$/.test(d) ? d : null
}

/* ---------- Khởi tạo: tạo bảng + khóa ký phiên đăng nhập (lưu trong D1, mỗi lần khởi động chỉ đọc 1 lần) ---------- */

let ready = null
function setup(env) {
  ready ??= (async () => {
    await env.DB.batch(SCHEMA.map(sql => env.DB.prepare(sql)))
    // Bảng users tạo từ bản cũ chưa có cột role → thêm vào (đã có thì bỏ qua lỗi)
    await env.DB.prepare(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'`).run().catch(() => {})
    await env.DB.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES ('session_secret', ?)`)
      .bind(b64(crypto.getRandomValues(new Uint8Array(32)))).run()
    const { value } = await env.DB.prepare(`SELECT value FROM config WHERE key = 'session_secret'`).first()
    return crypto.subtle.importKey('raw', unb64(value), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  })().catch(error => { ready = null; throw error })
  return ready
}

/* ---------- Mật khẩu: PBKDF2-SHA256, lưu dạng pbkdf2$<vòng>$<muối>$<băm> ---------- */

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256))
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITER))}`
}

export async function checkPassword(password, stored) {
  const [kind, iter, salt, hash] = String(stored).split('$')
  if (kind !== 'pbkdf2') return false
  const got = await pbkdf2(password, unb64(salt), Number(iter))
  const want = unb64(hash)
  return got.length === want.length && crypto.subtle.timingSafeEqual(got, want)
}

/* ---------- Phiên đăng nhập: cookie "<id>.<hết hạn>.<chữ ký>" (HttpOnly, không đọc được từ JavaScript) ---------- */

async function makeSession(key, userId) {
  const body = `${userId}.${Date.now() + SESSION_DAYS * 86400e3}`
  const sig = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  return `${COOKIE}=${body}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`
}

async function readSession(request, key) {
  const raw = (request.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))
  const [id, exp, sig] = (raw?.slice(COOKIE.length + 1) ?? '').split('.')
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', key, unb64url(sig), enc.encode(`${id}.${exp}`))
    return ok ? Number(id) : null
  } catch { return null }
}

const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
const publicUser = u => ({ id: u.id, phone: u.phone, name: u.name, role: u.role })

/* ---------- API ---------- */

async function api(request, env, path) {
  const key = await setup(env)
  const method = request.method
  const body = method === 'POST' || method === 'PUT' ? (await request.json().catch(() => null)) ?? {} : {}

  if (path === 'login' && method === 'POST') {
    const phone = normalizePhone(body.phone)
    if (!phone || typeof body.password !== 'string') return fail('Sai số điện thoại hoặc mật khẩu.', 400)
    const user = await env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first()
    if (!user) return fail('Sai số điện thoại hoặc mật khẩu.', 401)
    if (user.locked_until > Date.now()) return fail('Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.', 429)
    if (!(await checkPassword(body.password, user.password))) {
      const fails = user.fails + 1
      await env.DB.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE id = ?')
        .bind(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0, user.id).run()
      return fail('Sai số điện thoại hoặc mật khẩu.', 401)
    }
    if (user.fails) await env.DB.prepare('UPDATE users SET fails = 0 WHERE id = ?').bind(user.id).run()
    return json(publicUser(user), 200, { 'set-cookie': await makeSession(key, user.id) })
  }

  if (path === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie })

  const userId = await readSession(request, key)
  const user = userId && await env.DB.prepare('SELECT id, phone, name, role FROM users WHERE id = ?').bind(userId).first()
  if (!user) return fail('Chưa đăng nhập.', 401)

  if (path === 'me' && method === 'GET') return json(publicUser(user))

  if (path === 'password' && method === 'POST') {
    if (typeof body.password !== 'string' || body.password.length < 6) return fail('Mật khẩu mới cần ít nhất 6 ký tự.', 400)
    await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(await hashPassword(body.password), user.id).run()
    return json({ ok: true })
  }

  if (path === 'progress' && method === 'GET') {
    const row = await env.DB.prepare('SELECT data FROM progress WHERE user_id = ?').bind(user.id).first()
    return json({ data: row ? JSON.parse(row.data) : null })
  }

  if (path === 'progress' && method === 'PUT') {
    const data = JSON.stringify(body ?? {})
    if (data.length > 2_000_000) return fail('Dữ liệu tiến độ quá lớn.', 413)
    await env.DB.prepare(`INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(user.id, data).run()
    return json({ ok: true })
  }

  if (path.startsWith('admin/')) {
    if (user.role !== 'admin') return fail('Chỉ quản trị viên mới làm được việc này.', 403)
    return admin(env, user, method, path.slice(6), body)
  }

  return fail('Không tìm thấy.', 404)
}

/* ---------- Quản trị viên: quản lý tài khoản học viên ---------- */

async function admin(env, me, method, path, body) {
  if (path === 'users' && method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT u.id, u.phone, u.name, u.role, u.created_at, p.updated_at AS last_sync
      FROM users u LEFT JOIN progress p ON p.user_id = u.id ORDER BY u.created_at DESC, u.id DESC`).all()
    return json({ users: results })
  }

  // Tạo nhiều tài khoản: { people: [{ phone, name }] } → mật khẩu mặc định, người đã có thì bỏ qua
  if (path === 'users' && method === 'POST') {
    const people = Array.isArray(body.people) ? body.people.slice(0, 1000) : []
    const hash = await hashPassword(DEFAULT_PASSWORD)   // cùng một mật khẩu mặc định → băm một lần
    const results = []
    for (const p of people) {
      const phone = normalizePhone(p.phone)
      const name = String(p.name ?? '').trim().slice(0, 100)
      if (!phone) { results.push({ phone: String(p.phone ?? ''), name, status: 'invalid' }); continue }
      const { meta } = await env.DB.prepare('INSERT INTO users (phone, name, password) VALUES (?, ?, ?) ON CONFLICT (phone) DO NOTHING')
        .bind(phone, name, hash).run()
      results.push({ phone, name, status: meta.changes ? 'created' : 'exists' })
    }
    return json({ results, password: DEFAULT_PASSWORD })
  }

  const m = path.match(/^users\/(\d+)(?:\/(reset|role))?$/)
  if (!m) return fail('Không tìm thấy.', 404)
  const id = Number(m[1])
  const target = await env.DB.prepare('SELECT id, phone, role FROM users WHERE id = ?').bind(id).first()
  if (!target) return fail('Không có tài khoản này.', 404)

  if (m[2] === 'reset' && method === 'POST') {
    await env.DB.prepare('UPDATE users SET password = ?, fails = 0, locked_until = 0 WHERE id = ?')
      .bind(await hashPassword(DEFAULT_PASSWORD), id).run()
    return json({ ok: true, password: DEFAULT_PASSWORD })
  }
  if (m[2] === 'role' && method === 'POST') {
    if (id === me.id) return fail('Không thể tự bỏ quyền quản trị của chính mình.', 400)
    const role = body.role === 'admin' ? 'admin' : 'student'
    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run()
    return json({ ok: true, role })
  }
  if (!m[2] && method === 'DELETE') {
    if (id === me.id) return fail('Không thể tự xóa tài khoản của chính mình.', 400)
    await env.DB.batch([
      env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ])
    return json({ ok: true })
  }
  return fail('Không tìm thấy.', 404)
}

/* ---------- Bài học, slide, âm thanh từ R2 (có hỗ trợ ETag và tải từng đoạn cho âm thanh) ---------- */

async function data(request, env, key) {
  const userId = await readSession(request, await setup(env))
  if (!userId) return fail('Chưa đăng nhập.', 401)
  if (!key || key.includes('..')) return fail('Không tìm thấy.', 404)

  const object = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers })
  if (!object) return fail('Không tìm thấy.', 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('accept-ranges', 'bytes')
  // Nội dung riêng cho người đã đăng nhập: chỉ trình duyệt được lưu tạm, máy chủ trung gian thì không.
  headers.set('cache-control', (headers.get('cache-control') ?? 'max-age=600').replace(/\bpublic\b/, 'private'))
  if (!('body' in object)) return new Response(null, { status: 304, headers })

  if (request.headers.has('range') && object.range) {
    const { offset = object.size - object.range.suffix, length = object.size - offset } = object.range
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
    return new Response(object.body, { status: 206, headers })
  }
  return new Response(object.body, { headers })
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    try {
      if (pathname.startsWith('/api/')) return await api(request, env, pathname.slice(5))
      if (pathname.startsWith('/data/')) return await data(request, env, decodeURIComponent(pathname.slice(6)))
    } catch (error) {
      console.error(error)
      return fail('Máy chủ đang lỗi, thử lại sau ít phút.', 500)
    }
    return env.ASSETS.fetch(request)
  },
}
