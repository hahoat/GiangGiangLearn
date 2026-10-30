import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { pairSyllables, segment, toneOf } from './lib/chinese.js'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

/* ---------- Âm thanh ---------- */

export function speak(text, rate, onEnd) {
  if (!('speechSynthesis' in window)) { setTimeout(() => onEnd?.(), 600); return }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = rate
  utterance.onend = () => onEnd?.()
  utterance.onerror = () => onEnd?.()
  window.speechSynthesis.speak(utterance)
}

export function useSpeaker() {
  const { settings } = useApp()
  const [playing, setPlaying] = useState(null)
  const play = (text, { key = text, slow = false } = {}) => { setPlaying(key); speak(text, slow ? 0.5 : settings.rate, () => setPlaying(null)) }
  return [playing, play]
}

/* ---------- Chữ Hán ---------- */

// Một chữ kèm pinyin phía trên (ruby), tô màu theo thanh điệu nếu bật.
function Glyph({ ch, py, tone, plain }) {
  const { settings } = useApp()
  const cls = !plain && settings.toneColor && tone ? `t${tone}` : ''
  const showPy = settings.pinyin && !plain && py
  return <ruby className={cls}>{ch}{showPy ? <rt><span>{py}</span></rt> : <rt />}</ruby>
}

// Câu tiếng Trung: tự tách từ theo từ điển, chạm vào từ để tra nghĩa.
export function Sentence({ text, className = '', plain = false }) {
  const { openWord } = useApp()
  return <span className={`han-text ${className}`}>
    {segment(text).map((token, i) => {
      if (!token.entry) return <Glyph key={i} ch={token.text} plain />
      const glyphs = pairSyllables(token.entry.han, token.entry.py).map((g, j) => <Glyph key={j} {...g} plain={plain} />)
      return <button key={i} className="word" onClick={e => { e.stopPropagation(); openWord(token.entry, e.currentTarget) }}>{glyphs}</button>
    })}
  </span>
}

// Một từ đơn với pinyin cho trước.
export function Word({ han, py, plain = false, className = '' }) {
  return <span className={`han-text ${className}`}>{pairSyllables(han, py).map((g, i) => <Glyph key={i} {...g} plain={plain} />)}</span>
}

export function PinyinText({ py }) {
  const { settings } = useApp()
  return <span className="py-text">{py.split(' ').map((s, i) => <span key={i} className={settings.toneColor ? `t${toneOf(s)}` : ''}>{s} </span>)}</span>
}

export function SpeakButton({ text, small }) {
  const [playing, play] = useSpeaker()
  return <span className={`speak ${small ? 'small' : ''}`}>
    <button className={playing === text ? 'on' : ''} onClick={e => { e.stopPropagation(); play(text) }} aria-label="Nghe">{playing === text ? '◼' : '▶'}</button>
    {!small && <button className={`slow ${playing === 'slow' ? 'on' : ''}`} onClick={e => { e.stopPropagation(); play(text, { key: 'slow', slow: true }) }} aria-label="Nghe chậm" title="Nghe chậm">🐢</button>}
  </span>
}

export function Translation({ children }) {
  const { settings } = useApp()
  const [peek, setPeek] = useState(false)
  if (settings.translation || peek) return <span className="vi">{children}</span>
  return <button className="vi hidden-vi" onClick={e => { e.stopPropagation(); setPeek(true) }}>Hiện nghĩa</button>
}

export function StepHead({ title, desc, children }) {
  return <div className="step-head"><div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>{children && <div className="step-tools">{children}</div>}</div>
}

/* ---------- Popup tra từ ---------- */

export function WordPopover({ word, anchor, onClose }) {
  const { srs, addToDeck } = useApp()
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: -999, left: 0 })
  useEffect(() => {
    const r = anchor.getBoundingClientRect()
    const width = 260
    setPos({ top: r.bottom + 8, left: Math.min(Math.max(12, r.left + r.width / 2 - width / 2), window.innerWidth - width - 12) })
    const close = e => { if (!ref.current?.contains(e.target)) onClose() }
    const esc = e => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    window.addEventListener('scroll', onClose, { passive: true })
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); window.removeEventListener('scroll', onClose) }
  }, [anchor, onClose])
  const inDeck = Boolean(srs[word.han])
  return <div className="popover" ref={ref} style={pos} role="dialog" aria-label={`Nghĩa của ${word.han}`}>
    <div className="pop-head"><Word han={word.han} py={word.py} className="pop-han" /><SpeakButton text={word.han} small /></div>
    <PinyinText py={word.py} />
    <p>{word.meaning}</p>
    <button className="btn btn-soft btn-sm" disabled={inDeck} onClick={() => addToDeck(word)}>{inDeck ? '✓ Có trong bộ ôn tập' : '＋ Thêm vào ôn tập'}</button>
  </div>
}
