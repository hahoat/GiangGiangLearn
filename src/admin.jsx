// Trang "Quản lý học viên" – chỉ hiện với quản trị viên (role = 'admin').
// Tạo tài khoản hàng loạt (dán danh sách, kể cả dán thẳng từ Excel), đặt lại mật khẩu, cấp quyền, xóa.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi, normalizePhone } from './lib/sync.js'

// Mỗi dòng: "0912345678 | Nguyễn Văn An", hoặc 2 cột dán từ Excel (tên và số điện thoại theo thứ tự nào cũng được)
export function parsePeople(text) {
  const people = [], bad = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split(/[|\t;,]/).map(x => x.trim()).filter(Boolean)
    const i = parts.findIndex(x => normalizePhone(x))
    if (i < 0) { bad.push(line.trim()); continue }
    people.push({ phone: normalizePhone(parts[i]), name: parts.filter((_, j) => j !== i).join(' ') })
  }
  return { people, bad }
}

const STATUS = { created: '✓ Đã tạo', exists: '– Đã có, bỏ qua', invalid: '✗ Số không hợp lệ' }

export function AdminView({ me }) {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(null)

  const reload = useCallback(() => adminApi.list().then(d => { setUsers(d.users); setError(null) }).catch(e => setError(e.message)), [])
  useEffect(() => { reload() }, [reload])

  const parsed = useMemo(() => parsePeople(text), [text])
  const create = async e => {
    e.preventDefault()
    if (!parsed.people.length) return
    setBusy(true); setReport(null)
    try {
      const { results, password } = await adminApi.create(parsed.people)
      setReport({ results, password, bad: parsed.bad })
      setText('')
      reload()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const act = async (fn, done) => {
    try { await fn(); setNotice(done); reload() } catch (err) { setNotice(`⚠ ${err.message}`) }
  }
  const reset = u => window.confirm(`Đặt lại mật khẩu của ${u.phone} về 12345678?`) &&
    act(() => adminApi.reset(u.id), `✓ Mật khẩu của ${u.phone} đã về 12345678`)
  const toggleRole = u => {
    const role = u.role === 'admin' ? 'student' : 'admin'
    const msg = role === 'admin' ? `Cấp quyền quản trị cho ${u.phone}? Người này sẽ tạo, xóa được tài khoản.` : `Bỏ quyền quản trị của ${u.phone}?`
    if (window.confirm(msg)) act(() => adminApi.setRole(u.id, role), `✓ Đã ${role === 'admin' ? 'cấp' : 'bỏ'} quyền quản trị cho ${u.phone}`)
  }
  const remove = u => window.confirm(`Xóa tài khoản ${u.phone} ${u.name}? Tiến độ học của người này cũng bị xóa, không khôi phục được.`) &&
    act(() => adminApi.remove(u.id), `✓ Đã xóa ${u.phone}`)

  const q = query.trim().toLowerCase()
  const shown = (users ?? []).filter(u => !q || u.phone.includes(q.replace(/\D/g, '') || q) || u.name.toLowerCase().includes(q))

  return <section className="admin">
    <h1>Quản lý học viên</h1>

    <form className="admin-card" onSubmit={create}>
      <h2>Tạo tài khoản</h2>
      <p className="muted small">Mỗi dòng một học viên: <code>0912345678 | Nguyễn Văn An</code>. Có thể dán thẳng 2 cột (họ tên, số điện thoại) từ Excel. Mật khẩu mặc định: <b>12345678</b>. Người đã có tài khoản sẽ được bỏ qua.</p>
      <textarea rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={'0912345678 | Nguyễn Văn An\n0987654321 | Trần Thị Bình'} />
      <div className="admin-row">
        <span className="muted small">{parsed.people.length} học viên hợp lệ{parsed.bad.length ? ` · ${parsed.bad.length} dòng không có số điện thoại hợp lệ` : ''}</span>
        <button className="btn btn-primary" disabled={busy || !parsed.people.length}>{busy ? 'Đang tạo…' : `Tạo ${parsed.people.length || ''} tài khoản`}</button>
      </div>
      {report && <div className="admin-report">
        <p><b>{report.results.filter(r => r.status === 'created').length}</b> tài khoản mới (mật khẩu {report.password}) · {report.results.filter(r => r.status === 'exists').length} đã có</p>
        <ul>{report.results.filter(r => r.status !== 'created').map(r => <li key={r.phone}>{STATUS[r.status]}: {r.phone} {r.name}</li>)}</ul>
        {report.bad.length > 0 && <ul>{report.bad.map(l => <li key={l}>✗ Bỏ qua: {l}</li>)}</ul>}
      </div>}
    </form>

    <div className="admin-card">
      <div className="admin-row">
        <h2>Danh sách tài khoản {users && <span className="muted">({users.length})</span>}</h2>
        <input className="admin-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm số điện thoại hoặc tên" />
      </div>
      {notice && <p className={`sync-state ${notice.startsWith('⚠') ? 'error' : 'idle'}`}>{notice}</p>}
      {error && <p className="sync-state error">⚠ {error}</p>}
      {!users ? <p className="muted">Đang tải…</p> : <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Số điện thoại</th><th>Họ tên</th><th>Học gần nhất</th><th /></tr></thead>
        <tbody>{shown.map(u => <tr key={u.id}>
          <td>{u.phone}{u.role === 'admin' && <i className="admin-badge">Quản trị</i>}</td>
          <td>{u.name}</td>
          <td className="muted small">{u.last_sync ? new Date(u.last_sync.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN') : 'Chưa học'}</td>
          <td className="admin-actions">
            <button className="btn btn-ghost" onClick={() => reset(u)}>Đặt lại MK</button>
            {u.id !== me.id && <button className="btn btn-ghost" onClick={() => toggleRole(u)}>{u.role === 'admin' ? 'Bỏ quản trị' : 'Cấp quản trị'}</button>}
            {u.id !== me.id && <button className="btn btn-ghost danger" onClick={() => remove(u)}>Xóa</button>}
          </td>
        </tr>)}</tbody>
      </table></div>}
    </div>
  </section>
}
