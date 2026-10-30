import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { dayKey, isDue, schedule, setGlossary, streakOf } from './lib/chinese.js'
import { loadGlossary, loadIndex, loadLesson } from './lib/content.js'
import { mergeState } from './lib/merge.js'
import { fetchRemote, googleEnabled, pushRemote, signInWithEmail, signInWithGoogle, signOut, syncEnabled, watchUser } from './lib/sync.js'
import { AppContext, Sentence, WordPopover, useApp } from './ui.jsx'
import { FlashcardStep, GrammarStep, LectureStep, PracticeStep, ReadingStep, ReviewView, VocabStep, steps } from './steps.jsx'
import './styles.css'

/* ================= Trạng thái lưu trong trình duyệt ================= */

function usePersistent(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* bộ nhớ đầy hoặc bị chặn */ } }, [key, value])
  return [value, setValue]
}

const defaultSettings = { pinyin: true, toneColor: true, translation: true, rate: 0.8, size: 'md', dark: false, goal: 30 }

/* ================= Điều hướng bằng địa chỉ: #/hsk1/3/flashcard ================= */

function useHashRoute() {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [parts, setParts] = useState(parse)
  useEffect(() => {
    const onChange = () => setParts(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const go = useCallback(path => { window.location.hash = `#/${path}` }, [])
  return [parts, go]
}

/* ================= Khung trang ================= */

function Header({ view, courses, courseId, onCourse, dueCount, onReview, onLesson, onSettings, onMenu, onLogin, user }) {
  const groups = [...new Set(courses.map(c => c.group))]
  return <header className="header">
    <button className="icon-btn only-mobile" onClick={onMenu} aria-label="Danh sách bài">☰</button>
    <a className="logo" href="#/"><span className="logo-mark">江</span><span><b>Giang Giang</b><small>Học tiếng Trung</small></span></a>
    <nav className="main-nav">
      <button className={view === 'lesson' ? 'active' : ''} onClick={onLesson}>📖 <span>Bài học</span></button>
      <button className={view === 'review' ? 'active' : ''} onClick={onReview}>🔁 <span>Ôn tập</span>{dueCount > 0 && <i className="badge">{dueCount}</i>}</button>
    </nav>
    <label className="level-select">
      <span className="sr-only">Giáo trình</span>
      <select value={courseId} onChange={e => onCourse(e.target.value)}>
        {groups.map(g => <optgroup key={g} label={g}>
          {courses.filter(c => c.group === g).map(c => <option key={c.id} value={c.id}>{c.label}{c.lessons.length ? '' : ' (sắp có)'}</option>)}
        </optgroup>)}
      </select>
    </label>
    <button className="icon-btn" onClick={onSettings} aria-label="Cài đặt hiển thị" title="Cài đặt hiển thị">Aa</button>
    {syncEnabled && <button className={`icon-btn user-btn ${user ? 'in' : ''}`} onClick={onLogin} title={user ? user.email : 'Đăng nhập để đồng bộ tiến độ'}>
      {user ? (user.email?.[0] ?? '✓').toUpperCase() : <><span className="only-wide">Đăng nhập</span><span className="only-narrow">👤</span></>}
    </button>}
  </header>
}

function TodayCard({ xp, goal, streak, dueCount, onReview }) {
  const p = Math.min(1, xp / goal)
  return <section className="today">
    <div className="today-ring" style={{ '--p': p }}><div><b>{xp}</b><small>/{goal} XP</small></div></div>
    <div className="today-copy">
      <strong>{p >= 1 ? 'Đạt mục tiêu hôm nay 🎉' : 'Mục tiêu hôm nay'}</strong>
      <span>🔥 {streak} ngày liên tiếp</span>
      {dueCount > 0 ? <button className="link" onClick={onReview}>Ôn {dueCount} thẻ đến hạn →</button> : <span className="muted">Không có thẻ cần ôn</span>}
    </div>
  </section>
}

function Sidebar({ course, lessonId, progress, open, onClose, today, onPick }) {
  return <>
    <div className={`backdrop ${open ? 'show' : ''}`} onClick={onClose} />
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      {today}
      <div className="side-title"><span>{course.label} · {course.book}</span><small>{course.lessons.length ? `${course.lessons.length} bài` : ''}</small></div>
      {!course.lessons.length && <p className="side-empty">Giáo trình này đang được cập nhật. Hãy quay lại sau nhé!</p>}
      <ol className="lesson-list">
        {course.lessons.map(item => {
          const pct = Math.round(((progress[`${course.id}-${item.id}`] ?? []).length / steps.length) * 100)
          return <li key={item.id}>
            <button className={lessonId === item.id ? 'active' : ''} onClick={() => { onPick(item.id); onClose() }}>
              <span className={`num ${pct === 100 ? 'done' : ''}`}>{pct === 100 ? '✓' : item.id}</span>
              <span className="lesson-copy"><b className="cn">{item.title}</b><small>{item.vi}</small>
                <span className="bar"><i style={{ width: `${pct}%` }} /></span>
              </span>
            </button>
          </li>
        })}
      </ol>
    </aside>
  </>
}

function SettingsPanel({ open, onClose }) {
  const { settings, setSettings } = useApp()
  const set = (k, v) => setSettings({ ...settings, [k]: v })
  const toggle = (k, label, desc) => <label className="toggle-row"><span><b>{label}</b><small>{desc}</small></span><input type="checkbox" checked={settings[k]} onChange={e => set(k, e.target.checked)} /><i /></label>
  const choice = (k, label, options) => <div className="choice-row"><b>{label}</b><div className="segmented">{options.map(([v, t]) => <button key={v} className={settings[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{t}</button>)}</div></div>
  return <>
    <div className={`backdrop ${open ? 'show' : ''}`} onClick={onClose} />
    <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-head"><h2>Cài đặt hiển thị</h2><button className="icon-btn" onClick={onClose} aria-label="Đóng">×</button></div>
      <div className="preview-box"><Sentence text="你好！我是越南人。" /></div>
      {toggle('pinyin', 'Hiện pinyin', 'Tắt khi đã quen mặt chữ để luyện đọc')}
      {toggle('toneColor', 'Tô màu thanh điệu', 'Mỗi thanh một màu, giúp nhớ thanh nhanh hơn')}
      <div className="tone-legend"><span className="t1">1 ā</span><span className="t2">2 á</span><span className="t3">3 ǎ</span><span className="t4">4 à</span><span className="t5">nhẹ a</span></div>
      {toggle('translation', 'Hiện bản dịch', 'Ẩn đi để tự đoán nghĩa trước')}
      {choice('size', 'Cỡ chữ Hán', [['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn']])}
      {choice('rate', 'Tốc độ đọc', [[0.6, 'Chậm'], [0.8, 'Vừa'], [1, 'Chuẩn']])}
      {choice('goal', 'Mục tiêu mỗi ngày', [[20, '20 XP'], [30, '30 XP'], [50, '50 XP']])}
      {toggle('dark', 'Chế độ tối', 'Dễ chịu hơn khi học buổi tối')}
    </aside>
  </>
}

function LoginPanel({ open, onClose, user, syncState }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const send = async e => {
    e.preventDefault()
    setStatus('sending')
    try { await signInWithEmail(email.trim()); setStatus('sent') } catch (err) { setStatus(`error:${err.message}`) }
  }
  return <>
    <div className={`backdrop ${open ? 'show' : ''}`} onClick={onClose} />
    <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-head"><h2>{user ? 'Tài khoản' : 'Đăng nhập'}</h2><button className="icon-btn" onClick={onClose} aria-label="Đóng">×</button></div>
      {user ? <>
        <p className="account">Đang đăng nhập: <b>{user.email}</b></p>
        <p className={`sync-state ${syncState}`}>{{ idle: '✓ Tiến độ đã được đồng bộ', saving: '… Đang lưu lên tài khoản', error: '⚠ Chưa đồng bộ được – sẽ thử lại khi có mạng', loading: '… Đang tải tiến độ từ tài khoản' }[syncState]}</p>
        <p className="muted small">Tiến độ học, lịch ôn tập và XP được lưu vào tài khoản. Đăng nhập cùng email trên máy khác để học tiếp.</p>
        <button className="btn btn-ghost" onClick={() => { signOut(); onClose() }}>Đăng xuất</button>
      </> : <>
        <p className="muted small">Đăng nhập để lưu tiến độ vào tài khoản và học tiếp trên điện thoại, máy tính khác. Không cần mật khẩu: web sẽ gửi đường link đăng nhập vào email của bạn.</p>
        {status === 'sent' ? <p className="sync-state idle">📧 Đã gửi link đăng nhập tới <b>{email}</b>. Mở email trên máy này và bấm vào link.</p>
          : <form className="login-form" onSubmit={send}>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cua-ban.com" autoComplete="email" />
            <button className="btn btn-primary" disabled={status === 'sending'}>{status === 'sending' ? 'Đang gửi…' : 'Gửi link đăng nhập'}</button>
          </form>}
        {status?.startsWith('error:') && <p className="sync-state error">⚠ {status.slice(6)}</p>}
        {googleEnabled && <button className="btn btn-ghost btn-block" onClick={() => signInWithGoogle()}>Đăng nhập bằng Google</button>}
        <p className="muted small">Chưa đăng nhập vẫn học bình thường; tiến độ được lưu trên máy này và sẽ được gộp vào tài khoản khi bạn đăng nhập.</p>
      </>}
    </aside>
  </>
}

function Stepper({ step, onStep, done }) {
  const ref = useRef(null)
  useEffect(() => {
    const nav = ref.current, el = nav?.querySelector('.current')
    if (el) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }, [step])
  let lastStage = null
  return <nav className="stepper" ref={ref} aria-label="Các phần của bài học">
    {steps.map((s, i) => {
      const stage = s.stage !== lastStage ? (lastStage = s.stage) : null
      return <React.Fragment key={s.id}>
        {stage && i > 0 && <span className="stage-sep" aria-hidden="true" />}
        <button title={`${s.stage}: ${s.label}`} className={`${i === step ? 'current' : ''} ${done.includes(s.id) ? 'done' : ''}`} onClick={() => onStep(s.id)} aria-current={i === step ? 'step' : undefined}>
          <span className="dot">{done.includes(s.id) ? '✓' : i + 1}</span>
          <span className="step-label">{stage && <small>{stage}</small>}{s.label}</span>
        </button>
      </React.Fragment>
    })}
  </nav>
}

/* ================= Trang bài học ================= */

function LessonView({ course, lessonId, stepId, go, progress, markDone, earn }) {
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let alive = true
    setLesson(null)
    setError(null)
    loadLesson(course.id, lessonId).then(l => alive && setLesson(l)).catch(e => alive && setError(e))
    return () => { alive = false }
  }, [course.id, lessonId])
  const top = useRef(null)
  const key = `${course.id}-${lessonId}`
  const done = progress[key] ?? []
  const stepIndex = Math.max(0, steps.findIndex(s => s.id === stepId))
  const current = steps[stepIndex]
  const goStep = id => { go(`${course.id}/${lessonId}/${id}`); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const finish = () => { markDone(key, current.id); if (stepIndex + 1 < steps.length) goStep(steps[stepIndex + 1].id) }

  if (error) return <div className="lesson"><section className="step-card empty-state"><span className="big">⚠️</span><h2>Không tải được bài học</h2><p>Kiểm tra kết nối mạng rồi thử lại.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Tải lại</button></section></div>
  if (!lesson) return <div className="lesson"><div className="loading">Đang tải bài học…</div></div>

  const pct = Math.round((done.length / steps.length) * 100)
  const body = {
    lecture: <LectureStep course={course.id} lesson={lesson} onDone={finish} />,
    flashcard: <FlashcardStep key={key} lesson={lesson} onDone={finish} />,
    grammar: <GrammarStep lesson={lesson} />,
    vocab: <VocabStep lesson={lesson} openCard={() => goStep('flashcard')} />,
    reading: <ReadingStep lesson={lesson} />
  }[current.id] ?? <PracticeStep key={`${key}-${current.id}`} type={current.id} lesson={lesson} earn={earn} onAllDone={() => markDone(key, current.id)} />
  const isPractice = ['choice', 'order', 'fill'].includes(current.id)
  const lessons = course.lessons
  const pos = lessons.findIndex(l => l.id === lessonId)

  return <div className="lesson">
    <section className="lesson-head" ref={top}>
      <div>
        <span className="crumb">{course.label} · Bài {lesson.id}</span>
        <h1><Sentence text={lesson.title} /></h1>
        <p>{lesson.vi}</p>
      </div>
      <div className="lesson-meta">
        <div className="meta-ring" style={{ '--p': pct / 100 }}><span>{pct}%</span></div>
        <small>{done.length}/{steps.length} phần</small>
      </div>
    </section>
    {lesson.goal && <p className="goal">🎯 {lesson.goal}</p>}
    <Stepper step={stepIndex} onStep={goStep} done={done} />
    <section className="step-card" key={current.id}>{body}</section>
    <div className="step-nav">
      <button className="btn btn-ghost" disabled={stepIndex === 0} onClick={() => goStep(steps[stepIndex - 1].id)}>← Trước</button>
      <span className="step-count">{current.icon} {current.stage} · {stepIndex + 1}/{steps.length}</span>
      {stepIndex + 1 < steps.length
        ? <button className={`btn ${isPractice || current.id === 'flashcard' ? 'btn-ghost' : 'btn-primary'}`} onClick={isPractice || current.id === 'flashcard' ? () => goStep(steps[stepIndex + 1].id) : finish}>
          {isPractice || current.id === 'flashcard' ? 'Phần tiếp →' : 'Xong, tiếp tục →'}</button>
        : pos + 1 < lessons.length
          ? <button className="btn btn-primary" onClick={() => go(`${course.id}/${lessons[pos + 1].id}/lecture`)}>Sang bài {lessons[pos + 1].id} →</button>
          : <span />}
    </div>
  </div>
}

function ComingSoon({ course }) {
  return <div className="lesson"><section className="step-card empty-state">
    <span className="big">📚</span>
    <h2>{course.label} đang được cập nhật</h2>
    <p>Giáo viên đang soạn bài giảng, từ vựng và bài tập cho giáo trình {course.book}. Trong lúc chờ, bạn có thể học HSK 1.</p>
    <a className="btn btn-primary" href="#/hsk1/1/lecture">Học HSK 1</a>
  </section></div>
}

/* ================= App ================= */

function App() {
  const [settings, setSettings] = usePersistent('gg-settings', defaultSettings)
  const [progress, setProgress] = usePersistent('gg-progress-v3', {})
  const [srs, setSrs] = usePersistent('gg-srs-v2', {})
  const [log, setLog] = usePersistent('gg-xp-log', {})
  const [courses, setCourses] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [parts, go] = useHashRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const [panel, setPanel] = useState(null)
  const [popover, setPopover] = useState(null)
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [syncState, setSyncState] = useState('idle')
  const remoteReady = useRef(false)

  const s = { ...defaultSettings, ...settings }
  useEffect(() => {
    document.documentElement.dataset.theme = s.dark ? 'dark' : 'light'
    document.documentElement.dataset.size = s.size
  }, [s.dark, s.size])

  useEffect(() => {
    Promise.all([loadIndex(), loadGlossary()])
      .then(([index, glossary]) => { setGlossary(glossary); setCourses(index) })
      .catch(() => setLoadError(true))
  }, [])

  /* ---- Đăng nhập & đồng bộ ---- */
  useEffect(() => {
    if (!syncEnabled) return
    let stop = () => {}
    watchUser(setUser).then(unsub => { stop = unsub })
    return () => stop()
  }, [])
  useEffect(() => {
    remoteReady.current = false
    if (!user) return
    let alive = true
    setSyncState('loading')
    fetchRemote(user.id)
      .then(remote => {
        if (!alive) return
        const merged = mergeState({ progress, srs, log }, remote ?? {})
        setProgress(merged.progress); setSrs(merged.srs); setLog(merged.log)
        remoteReady.current = true
        return pushRemote(user.id, merged).then(() => setSyncState('idle'))
      })
      .catch(() => alive && setSyncState('error'))
    return () => { alive = false }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user || !remoteReady.current) return
    setSyncState('saving')
    const t = setTimeout(() => pushRemote(user.id, { progress, srs, log }).then(() => setSyncState('idle')).catch(() => setSyncState('error')), 1500)
    return () => clearTimeout(t)
  }, [user, progress, srs, log])

  /* ---- Tiến độ, XP, ôn tập ---- */
  const xp = log[dayKey()] ?? 0
  const streak = streakOf(log)
  const dueCount = useMemo(() => Object.values(srs).filter(e => e.card && isDue(e)).length, [srs])

  const earn = useCallback(n => {
    const before = log[dayKey()] ?? 0
    if (before < s.goal && before + n >= s.goal) setToast('🎉 Bạn đã đạt mục tiêu hôm nay!')
    setLog(l => ({ ...l, [dayKey()]: (l[dayKey()] ?? 0) + n }))
  }, [log, setLog, s.goal])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  const markDone = useCallback((key, stepId) => {
    if ((progress[key] ?? []).includes(stepId)) return
    earn(10)
    setProgress(p => ({ ...p, [key]: [...new Set([...(p[key] ?? []), stepId])] }))
  }, [progress, earn, setProgress])
  const cardOf = ({ han, py, meaning, example }) => ({ han, py, meaning, example })
  const rate = useCallback((card, g) => {
    setSrs(m => ({ ...m, [card.han]: { ...schedule(m[card.han], g), t: Date.now(), card: cardOf(card) } }))
    earn(1)
  }, [setSrs, earn])
  const addToDeck = word => {
    setSrs(m => (m[word.han] ? m : { ...m, [word.han]: { ivl: 0, reps: 0, due: 0, t: Date.now(), card: cardOf({ ...word, example: word.han }) } }))
    setToast(`Đã thêm ${word.han} vào bộ ôn tập`)
  }
  const openWord = useCallback((word, anchor) => setPopover({ word, anchor }), [])
  const closeWord = useCallback(() => setPopover(null), [])

  if (loadError) return <div className="boot">Không tải được nội dung. Kiểm tra kết nối mạng rồi tải lại trang.</div>
  if (!courses) return <div className="boot">Đang tải…</div>

  /* ---- Xác định trang hiện tại từ địa chỉ ---- */
  const view = parts[0] === 'review' ? 'review' : 'lesson'
  const lastCourse = localStorage.getItem('gg-last-course')
  const course = courses.find(c => c.id === (view === 'review' ? lastCourse : parts[0])) ?? courses.find(c => c.id === lastCourse) ?? courses[0]
  const lessonId = Number(parts[1]) || course.lessons[0]?.id
  const stepId = steps.some(st => st.id === parts[2]) ? parts[2] : 'lecture'
  if (view === 'lesson') localStorage.setItem('gg-last-course', course.id)
  const validLesson = course.lessons.some(l => l.id === lessonId)

  const ctx = { settings: s, setSettings, openWord, srs, rate, addToDeck }
  const today = <TodayCard xp={xp} goal={s.goal} streak={streak} dueCount={dueCount} onReview={() => { go('review'); setMenuOpen(false) }} />

  return <AppContext.Provider value={ctx}>
    <div className="app">
      <Header view={view} courses={courses} courseId={course.id} user={user} dueCount={dueCount}
        onCourse={id => { const c = courses.find(x => x.id === id); go(c.lessons.length ? `${id}/${c.lessons[0].id}/lecture` : id) }}
        onLesson={() => go(`${course.id}${validLesson ? `/${lessonId}/${stepId}` : ''}`)} onReview={() => go('review')}
        onSettings={() => setPanel('settings')} onLogin={() => setPanel('login')} onMenu={() => setMenuOpen(true)} />
      <div className="layout">
        <Sidebar course={course} lessonId={view === 'lesson' ? lessonId : null} progress={progress} open={menuOpen} onClose={() => setMenuOpen(false)} today={today}
          onPick={id => go(`${course.id}/${id}/lecture`)} />
        <main className="main">
          {view === 'review' ? <ReviewView onBack={() => go(course.id)} />
            : !course.lessons.length ? <ComingSoon course={course} />
              : <LessonView course={course} lessonId={validLesson ? lessonId : course.lessons[0].id} stepId={stepId} go={go} progress={progress} markDone={markDone} earn={earn} />}
        </main>
      </div>
      <SettingsPanel open={panel === 'settings'} onClose={() => setPanel(null)} />
      {syncEnabled && <LoginPanel open={panel === 'login'} onClose={() => setPanel(null)} user={user} syncState={syncState} />}
      {popover && <WordPopover {...popover} onClose={closeWord} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  </AppContext.Provider>
}

createRoot(document.getElementById('root')).render(<App />)
