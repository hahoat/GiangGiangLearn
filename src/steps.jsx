import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { grades, intervalLabel, isDue, lookup } from './lib/chinese.js'
import { deckFile, loadDeck } from './lib/content.js'
import { PinyinText, Sentence, SpeakButton, StepHead, Translation, Word, useApp, useSpeaker } from './ui.jsx'

export const steps = [
  { id: 'lecture', stage: 'Bài giảng', label: 'Bài giảng', icon: '🎞️' },
  { id: 'flashcard', stage: 'Ôn tập', label: 'Flashcard', icon: '🃏' },
  { id: 'grammar', stage: 'Ôn tập', label: 'Ngữ pháp', icon: '🧩' },
  { id: 'vocab', stage: 'Ôn tập', label: 'Từ vựng', icon: '📝' },
  { id: 'reading', stage: 'Thực hành', label: 'Bài khóa', icon: '📜' },
  { id: 'choice', stage: 'Thực hành', label: 'Chọn đáp án', icon: '✅' },
  { id: 'order', stage: 'Thực hành', label: 'Sắp xếp câu', icon: '🔀' },
  { id: 'fill', stage: 'Thực hành', label: 'Điền đáp án', icon: '✏️' }
]

const isTyping = e => e.target.closest?.('input, select, textarea')

/* ================= Bài giảng (slide) ================= */

export function LectureStep({ course, lesson, onDone }) {
  const [deckIndex, setDeckIndex] = useState(0)
  const [manifests, setManifests] = useState(null)
  useEffect(() => {
    let alive = true
    setManifests(null)
    setDeckIndex(0)
    Promise.allSettled(lesson.decks.map(d => loadDeck(course, d)))
      .then(results => alive && setManifests(results.map(r => (r.status === 'fulfilled' ? r.value : null))))
    return () => { alive = false }
  }, [course, lesson])

  const head = <StepHead title="Bài giảng" desc="Xem slide bài giảng của giáo viên. Dùng phím ← → để chuyển slide, bấm ▶ để nghe âm thanh." />
  if (!lesson.decks.length || (manifests && manifests.every(m => !m))) {
    return <>{head}<div className="empty-state small"><span className="big">🎞️</span><p>Bài giảng của bài này đang được cập nhật.</p></div></>
  }
  if (!manifests) return <>{head}<div className="loading">Đang tải bài giảng…</div></>
  const manifest = manifests[deckIndex]
  return <>
    {head}
    {lesson.decks.length > 1 && <div className="deck-tabs">
      {lesson.decks.map((d, i) => <button key={d} className={i === deckIndex ? 'on' : ''} disabled={!manifests[i]} onClick={() => setDeckIndex(i)}>
        Phần {i + 1}{manifests[i] && <small>{manifests[i].slides.length} slide</small>}
      </button>)}
    </div>}
    {manifest ? <SlideViewer key={manifest.id} course={course} manifest={manifest} onEnd={deckIndex + 1 < lesson.decks.length ? () => setDeckIndex(deckIndex + 1) : onDone} last={deckIndex + 1 >= lesson.decks.length} />
      : <div className="empty-state small"><p>Phần này đang được cập nhật.</p></div>}
  </>
}

function SlideViewer({ course, manifest, onEnd, last }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(null)
  const audio = useRef(null)
  const box = useRef(null)
  const strip = useRef(null)
  const total = manifest.slides.length
  const slide = manifest.slides[index]
  const file = f => deckFile(course, manifest.id, f)
  const go = useCallback(step => setIndex(i => Math.min(total - 1, Math.max(0, i + step))), [total])

  useEffect(() => {
    const onKey = e => {
      if (isTyping(e)) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])
  useEffect(() => {
    const next = manifest.slides[index + 1]
    if (next) new Image().src = file(next.img)
    audio.current?.pause()
    setPlaying(null)
    strip.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => audio.current?.pause(), [])

  const play = src => {
    audio.current?.pause()
    if (playing === src) { setPlaying(null); return }
    audio.current = new Audio(file(src))
    audio.current.onended = () => setPlaying(null)
    audio.current.play().then(() => setPlaying(src)).catch(() => setPlaying(null))
  }
  // Toàn màn hình thật nếu trình duyệt hỗ trợ; nếu không (iPhone/iPad) thì phủ kín cửa sổ bằng CSS.
  const [full, setFull] = useState(false)
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  useEffect(() => {
    if (!full) return
    const onKey = e => { if (e.key === 'Escape' && !document.fullscreenElement) setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])
  const fullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
    if (full) { setFull(false); return }
    const request = box.current?.requestFullscreen?.()
    if (request) request.catch(() => setFull(true)); else setFull(true)
  }

  // Chế độ phóng to dự phòng được đưa ra ngoài cùng trang để phủ kín màn hình
  const portal = full && document.fullscreenElement !== box.current
  const viewer = <div className={`slides ${portal ? 'is-full' : ''}`} ref={box}>
    <div className="slide-stage" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left > r.width / 3 ? 1 : -1) }}>
      <img src={file(slide.img)} alt={`Slide ${index + 1}`} />
    </div>
    <div className="slide-bar">
      <button className="btn btn-ghost btn-sm" onClick={() => go(-1)} disabled={index === 0}>←</button>
      <span className="slide-count">{index + 1} / {total}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => go(1)} disabled={index === total - 1}>→</button>
      {slide.audio?.map((a, i) => <button key={a} className={`btn btn-soft btn-sm ${playing === a ? 'on' : ''}`} onClick={() => play(a)}>{playing === a ? '◼ Dừng' : `▶ Nghe${slide.audio.length > 1 ? ` ${i + 1}` : ''}`}</button>)}
      {slide.hasVideo && <span className="slide-note" title="Video sẽ được bổ sung sau">🎬 có video</span>}
      <span className="spacer" />
      <button className="btn btn-ghost btn-sm" onClick={fullscreen} title={full ? "Thoát toàn màn hình (Esc)" : "Toàn màn hình"} aria-label="Toàn màn hình"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" /></svg></button>
      {index === total - 1 && <button className="btn btn-primary btn-sm" onClick={onEnd}>{last ? 'Xong bài giảng ✓' : 'Phần tiếp →'}</button>}
    </div>
    <div className="slide-strip" ref={strip}>
      {manifest.slides.map((s, i) => <button key={s.img} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`}>
        <img src={file(s.thumb)} alt="" loading="lazy" />{s.audio && <i>♪</i>}
      </button>)}
    </div>
  </div>
  return portal ? createPortal(viewer, document.body) : viewer
}

/* ================= Ôn tập ================= */

function useCardKeys(flipped, setFlipped, grade) {
  useEffect(() => {
    const onKey = e => {
      if (isTyping(e)) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
      const g = grades.find(x => x.key === e.key)
      if (g && flipped) grade(g.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, setFlipped, grade])
}

function CardView({ card, flipped, setFlipped }) {
  return <div className={`flash ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} role="button" aria-label="Lật thẻ">
    <div className="flash-inner">
      <div className="flash-face front">
        {/* Mặt trước chỉ có chữ Hán, không tô màu thanh điệu để không lộ đáp án */}
        <Word han={card.han} plain className="flash-han" />
        <span className="flash-hint">Tự nhớ cách đọc &amp; nghĩa, rồi nhấn để lật · Space</span>
      </div>
      <div className="flash-face back">
        <Word han={card.han} py={card.py} className="flash-han small" />
        <PinyinText py={card.py} />
        <span className="flash-meaning">{card.meaning}</span>
        {card.example && card.example !== card.han && <span className="flash-ex"><Sentence text={card.example} /></span>}
        <SpeakButton text={card.han} />
      </div>
    </div>
  </div>
}

function GradeBar({ entry, flipped, setFlipped, grade }) {
  if (!flipped) return <div className="grade-bar"><button className="btn btn-primary btn-block" onClick={() => setFlipped(true)}>Lật thẻ</button></div>
  return <div className="grade-bar grades">
    {grades.map(g => <button key={g.id} className={`grade ${g.id}`} onClick={() => grade(g.id)}>
      <b>{g.label}</b><small>{intervalLabel(entry, g.id)}</small><kbd>{g.key}</kbd>
    </button>)}
  </div>
}

export function FlashcardStep({ lesson, onDone }) {
  const { srs, rate } = useApp()
  const cards = lesson.vocab
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = cards[i]
  const grade = useCallback(g => {
    rate(card, g)
    setFlipped(false)
    if (i + 1 < cards.length) setI(i + 1); else onDone()
  }, [card, cards.length, i, onDone, rate])
  useCardKeys(flipped, setFlipped, grade)
  return <>
    <StepHead title="Flashcard" desc="Mặt trước là chữ Hán. Tự nhớ cách đọc và nghĩa, lật thẻ để xem pinyin + nghĩa, nghe cách đọc rồi tự chấm. Từ chấm “Quên/Khó” sẽ quay lại sớm trong trang Ôn tập."><span className="counter">{i + 1}/{cards.length}</span></StepHead>
    <div className="progress-line"><i style={{ width: `${(i / cards.length) * 100}%` }} /></div>
    <CardView card={card} flipped={flipped} setFlipped={setFlipped} />
    <GradeBar entry={srs[card.han]} flipped={flipped} setFlipped={setFlipped} grade={grade} />
    <p className="kbd-help">Phím tắt: <kbd>Space</kbd> lật thẻ · <kbd>1</kbd>–<kbd>4</kbd> tự chấm</p>
  </>
}

export function GrammarStep({ lesson }) {
  return <>
    <StepHead title="Tổng hợp ngữ pháp" desc={`${lesson.grammar.length} điểm ngữ pháp của bài. Chạm vào chữ trong câu ví dụ để tra nghĩa.`} />
    <div className="grammar-list">
      {lesson.grammar.map((g, i) => <article key={i} className="grammar-card">
        <h3><span>{i + 1}</span>{g.title}</h3>
        {g.desc.map((d, j) => <p key={j}>{d}</p>)}
        {g.formula && <div className="formula">{g.formula.split(/\s+([+·→=])\s+/).map((part, j) => /^[+·→=]$/.test(part)
          ? <i key={j}>{part}</i>
          : <span key={j} className={/^[㐀-鿿（）/ ]{1,6}$/.test(part) ? 'key cn' : /[㐀-鿿]/.test(part) ? 'cn' : ''}>{part}</span>)}</div>}
        {g.examples.map((ex, j) => <div key={j} className="example"><Sentence text={ex.han} /><SpeakButton text={ex.han} small /><Translation>{ex.vi}</Translation></div>)}
      </article>)}
    </div>
  </>
}

export function VocabStep({ lesson, openCard }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const list = lesson.vocab.filter(v => !q || [v.han, v.py, v.meaning].some(x => x.toLowerCase().includes(q)))
  return <>
    <StepHead title="Tổng hợp từ vựng" desc={`${lesson.vocab.length} từ của bài. Bấm ▶ để nghe, 🐢 để nghe chậm.`}>
      <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm chữ Hán, pinyin, nghĩa…" />
    </StepHead>
    <div className="vocab-list">
      {list.map(v => <div key={v.han} className="vocab-row">
        <Word han={v.han} py={v.py} className="vocab-han" />
        <div className="vocab-info">
          <PinyinText py={v.py} /><small className="pos">{v.pos}</small>
          <Translation>{v.meaning}</Translation>
          {v.example && <span className="vocab-ex"><Sentence text={v.example} plain /> <em>{v.exampleVi}</em></span>}
        </div>
        <SpeakButton text={v.han} />
      </div>)}
      {!list.length && <p className="empty">Không tìm thấy từ nào.</p>}
    </div>
    <button className="link" onClick={openCard}>Luyện các từ này bằng Flashcard →</button>
  </>
}

/* ================= Thực hành ================= */

export function ReadingStep({ lesson }) {
  const [playing, play] = useSpeaker()
  return <>
    <StepHead title="Bài khóa" desc="Lần 1: đọc có pinyin và nghe từng câu. Lần 2: tắt pinyin (nút Aa), tự đọc to và chỉ chạm vào từ khi bí." />
    {lesson.texts.map((text, t) => {
      const speakers = [...new Set(text.lines.map(l => l.who))]
      const all = text.lines.map(l => l.han).join('')
      return <section key={t} className="text-block">
        <div className="text-title"><h3>{text.title}</h3><button className="btn btn-soft btn-sm" onClick={() => play(all, { key: `all-${t}` })}>{playing === `all-${t}` ? '◼ Đang đọc' : '▶ Nghe cả bài'}</button></div>
        <div className="chat">
          {text.lines.map((line, i) => <div key={i} className={`bubble-row ${speakers.indexOf(line.who) % 2 ? 'B' : 'A'}`}>
            {line.who && <span className="avatar" title={line.who}>{[...line.who][0]}</span>}
            <div className={`bubble ${playing === line.han ? 'playing' : ''}`}>
              {line.who && <small className="who">{line.who}</small>}
              <Sentence text={line.han} className="bubble-han" />
              <Translation>{line.vi}</Translation>
              <button className="bubble-play" onClick={() => play(line.han)} aria-label="Nghe câu">{playing === line.han ? '◼' : '▶'}</button>
            </div>
          </div>)}
        </div>
      </section>
    })}
  </>
}

function Feedback({ ok, answer, sentence }) {
  return <div className={`feedback ${ok ? 'ok' : 'bad'}`} role="status">
    <b>{ok ? '✓ Chính xác!' : '✗ Chưa đúng'}</b>
    {!ok && <span>Đáp án đúng: <span className="cn">{answer}</span></span>}
    {sentence && <span className="fb-sentence"><Sentence text={sentence} /><SpeakButton text={sentence} small /></span>}
  </div>
}

function ChoiceQuestions({ items, onAnswer, results }) {
  const { settings } = useApp()
  return items.map((q, i) => {
    const picked = results[i]?.value
    const answered = picked !== undefined
    const full = q.q.replace('___', q.options[q.answer])
    return <div key={i} className="quiz">
      <div className="quiz-q"><span className="qn">{i + 1}</span><span className="cn quiz-text">{q.q.replace('___', ' ＿＿ ')}</span></div>
      {settings.translation && <p className="hint">{q.vi}</p>}
      <div className="choices">{q.options.map((o, j) => <button key={o} disabled={answered} className={`choice cn ${answered && j === q.answer ? 'right' : ''} ${answered && picked === j && j !== q.answer ? 'wrong' : ''}`} onClick={() => onAnswer(i, j, j === q.answer)}>
        <small>{String.fromCharCode(65 + j)}</small>{o}{settings.pinyin && lookup(o) && <em>{lookup(o).py}</em>}
      </button>)}</div>
      {answered && <Feedback ok={results[i].ok} answer={q.options[q.answer]} sentence={full} />}
    </div>
  })
}

function OrderQuestions({ items, onAnswer, results, reset }) {
  const { settings } = useApp()
  const [picked, setPicked] = useState({})
  return items.map((q, i) => {
    const cur = picked[i] ?? []
    const answered = results[i] !== undefined
    const choose = k => {
      const next = [...cur, k]
      setPicked(p => ({ ...p, [i]: next }))
      if (next.length === q.words.length) onAnswer(i, next, next.map(n => q.words[n]).join('') === q.answer.join(''))
    }
    return <div key={i} className="quiz">
      <div className="quiz-q"><span className="qn">{i + 1}</span>
        <div className={`slot ${answered ? (results[i].ok ? 'right' : 'wrong') : ''}`}>
          {cur.length ? cur.map(k => <button key={k} className="chip cn" disabled={answered} onClick={() => setPicked(p => ({ ...p, [i]: cur.filter(x => x !== k) }))}>{q.words[k]}</button>) : <span className="placeholder">Chạm các từ bên dưới theo đúng thứ tự…</span>}
          {cur.length > 0 && <span className="cn end-punct">{q.end}</span>}
        </div>
      </div>
      {settings.translation && <p className="hint">{q.vi}</p>}
      <div className="bank">{q.words.map((w, k) => <button key={k} className="chip cn" disabled={answered || cur.includes(k)} onClick={() => choose(k)}>{w}{settings.pinyin && lookup(w) && <em>{lookup(w).py}</em>}</button>)}</div>
      {answered && <>
        <Feedback ok={results[i].ok} answer={q.answer.join(' ')} sentence={q.answer.join('') + q.end} />
        {!results[i].ok && <button className="link retry" onClick={() => { reset(i); setPicked(p => ({ ...p, [i]: [] })) }}>↺ Thử lại câu này</button>}
      </>}
    </div>
  })
}

const normalize = s => s.replace(/[\s，。！？、,.!?]/g, '').replace(/儿$/, '')

function FillQuestions({ items, onAnswer, results }) {
  const [values, setValues] = useState({})
  return items.map((q, i) => {
    const answered = results[i] !== undefined
    const check = () => { const v = (values[i] ?? '').trim(); if (v) onAnswer(i, v, normalize(v) === normalize(q.answer)) }
    return <div key={i} className="quiz">
      <div className="quiz-q"><span className="qn">{i + 1}</span><span className="cn quiz-text">{q.q.replace('___', ' ＿＿ ')}</span></div>
      <p className="hint">Gợi ý: {q.hint}</p>
      <div className="fill-row">
        <input className="cn" value={values[i] ?? ''} disabled={answered} placeholder="Gõ chữ Hán" lang="zh-CN" onChange={e => setValues(v => ({ ...v, [i]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && check()} />
        <button className="btn btn-primary" disabled={answered} onClick={check}>Kiểm tra</button>
      </div>
      {answered && <Feedback ok={results[i].ok} answer={q.answer} sentence={q.q.replace('___', q.answer)} />}
    </div>
  })
}

const practiceInfo = {
  choice: ['Chọn đáp án', 'Chọn từ đúng để điền vào chỗ trống.'],
  order: ['Sắp xếp câu', 'Chạm các từ theo đúng thứ tự để tạo thành câu. Chạm lại vào từ đã chọn để bỏ.'],
  fill: ['Điền đáp án đúng', 'Gõ chữ Hán còn thiếu (dùng bộ gõ tiếng Trung, gõ pinyin rồi chọn chữ). Nhấn Enter để kiểm tra.']
}

export function PracticeStep({ type, lesson, earn, onAllDone }) {
  const items = lesson.practice[type]
  const [results, setResults] = useState({})
  const [round, setRound] = useState(0)
  const total = items.length
  const answered = Object.keys(results).length
  const correct = Object.values(results).filter(r => r.ok).length
  const onAnswer = (i, value, ok) => {
    setResults(r => ({ ...r, [i]: { value, ok } }))
    if (ok) earn(2)
  }
  useEffect(() => { if (answered === total) onAllDone() }, [answered]) // eslint-disable-line react-hooks/exhaustive-deps
  const reset = i => setResults(r => { const next = { ...r }; delete next[i]; return next })
  const props = { items, onAnswer, results, reset }
  const [title, desc] = practiceInfo[type]
  return <div key={round}>
    <StepHead title={title} desc={desc}>
      <span className="score-pill">{answered}/{total} đã làm · <b>{correct}</b> đúng</span>
    </StepHead>
    <div className="progress-line"><i style={{ width: `${(answered / total) * 100}%` }} /></div>
    {type === 'choice' ? <ChoiceQuestions {...props} /> : type === 'order' ? <OrderQuestions {...props} /> : <FillQuestions {...props} />}
    {answered === total && <div className={`result-box ${correct === total ? 'good' : ''}`}>
      <b>{correct === total ? '🎉 Xuất sắc! Đúng tất cả.' : `Bạn đúng ${correct}/${total} câu.`}</b>
      <button className="btn btn-ghost btn-sm" onClick={() => { setResults({}); setRound(round + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>↺ Làm lại cả phần</button>
    </div>}
  </div>
}

/* ================= Trang Ôn tập (lặp lại ngắt quãng) ================= */

export function ReviewView({ onBack }) {
  const { srs, rate } = useApp()
  const [queue, setQueue] = useState(() => Object.entries(srs).filter(([, e]) => e.card && isDue(e)).map(([han]) => han))
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const entry = srs[queue[0]]
  const card = entry?.card
  const grade = useCallback(g => {
    if (!card) return
    rate(card, g)
    setReviewed(n => n + 1)
    setFlipped(false)
    setQueue(q => (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
  }, [card, rate])
  useCardKeys(flipped, setFlipped, grade)
  const learned = Object.values(srs).filter(e => e.card).length
  if (!card) return <div className="lesson"><section className="step-card empty-state">
    <span className="big">{learned ? '🎉' : '🃏'}</span>
    <h2>{reviewed ? `Xong! Bạn đã ôn ${reviewed} lượt thẻ.` : learned ? 'Không có thẻ nào đến hạn ôn' : 'Chưa có thẻ nào để ôn'}</h2>
    <p>{learned ? `Bạn đang có ${learned} từ trong bộ ôn tập. Hệ thống tự hẹn ngày ôn lại: từ khó gặp lại sớm, từ dễ gặp lại muộn hơn.` : 'Hãy học phần Flashcard của một bài, các từ sẽ tự vào đây theo lịch ôn.'}</p>
    <button className="btn btn-primary" onClick={onBack}>Quay lại bài học</button>
  </section></div>
  return <div className="lesson">
    <section className="lesson-head"><div><span className="crumb">Lặp lại ngắt quãng</span><h1 className="plain-title">Ôn tập hôm nay</h1><p>Còn {queue.length} thẻ · đã ôn {reviewed}</p></div></section>
    <section className="step-card">
      <div className="progress-line"><i style={{ width: `${(reviewed / (reviewed + queue.length)) * 100}%` }} /></div>
      <CardView card={card} flipped={flipped} setFlipped={setFlipped} />
      <GradeBar entry={entry} flipped={flipped} setFlipped={setFlipped} grade={grade} />
      <p className="kbd-help">Phím tắt: <kbd>Space</kbd> lật thẻ · <kbd>1</kbd>–<kbd>4</kbd> tự chấm</p>
    </section>
  </div>
}
