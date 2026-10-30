// Đăng nhập + đồng bộ tiến độ qua Supabase. Chỉ bật khi có VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY;
// nếu không, web vẫn chạy bình thường và lưu tiến độ trong trình duyệt.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const syncEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)
export const googleEnabled = syncEnabled && import.meta.env.VITE_SUPABASE_GOOGLE === '1'

let clientPromise = null

export function getClient() {
  if (!syncEnabled) return null
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } }))
  return clientPromise
}

const redirectTo = () => window.location.origin + window.location.pathname

export async function signInWithEmail(email) {
  const sb = await getClient()
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
  if (error) throw error
}

export async function signInWithGoogle() {
  const sb = await getClient()
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
  if (error) throw error
}

export async function signOut() {
  const sb = await getClient()
  await sb.auth.signOut()
}

export async function watchUser(onUser) {
  const sb = await getClient()
  const { data } = await sb.auth.getSession()
  onUser(data.session?.user ?? null)
  const { data: sub } = sb.auth.onAuthStateChange((_event, session) => onUser(session?.user ?? null))
  return () => sub.subscription.unsubscribe()
}

export async function fetchRemote(userId) {
  const sb = await getClient()
  const { data, error } = await sb.from('progress').select('data').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.data ?? null
}

export async function pushRemote(userId, state) {
  const sb = await getClient()
  const { error } = await sb.from('progress').upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() })
  if (error) throw error
}
