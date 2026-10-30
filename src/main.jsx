import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flashcards, levels, lessons, practice } from './data.js'
import './styles.css'

const tabs = [
  ['learn', '◈', 'Học bài'], ['flashcard', '▣', 'Flashcard'], ['grammar', '▤', 'Ngữ pháp'], ['vocab', '▥', 'Từ vựng'],
  ['reading', '▥', 'Bài khóa'], ['choice', '☑', 'Chọn đáp án'], ['order', '☷', 'Sắp xếp câu'], ['fill', '✎', 'Điền đáp án']
]

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

function Sidebar({ level, setLevel, selected, setSelected }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">中</div><div><strong>Tiếng Trung <span>Giang Giang</span></strong><small>Học tiếng Trung mỗi ngày</small></div></div>
    <div className="level-switcher">
      {levels.map(item => <button key={item.id} className={level.id === item.id ? 'level active' : 'level'} onClick={() => { setLevel(item); setSelected(1) }}><span>{item.label}</span><small>{item.lessons} bài · {item.words} từ</small></button>)}
    </div>
    <div className="side-heading"><span>{level.label} · Giáo trình</span><button>＋</button></div>
    <div className="lesson-list">
      {lessons.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className={selected === item.id ? 'lesson active' : 'lesson'}>
        <span className="lesson-number">{item.id}</span><span className="lesson-copy"><strong>Bài {item.id}</strong><small>{item.title}</small></span><span className="lesson-status">{item.done ? `${item.done}/${item.words}` : '0%'}</span>
      </button>)}
    </div>
    <div className="sidebar-footer"><button><Icon>◫</Icon><span><strong>Ôn tập hôm nay</strong><small>8 thẻ đang chờ</small></span><b>›</b></button><button><Icon>⚙</Icon><span><strong>Cài đặt</strong><small>Tuỳ chỉnh học tập</small></span></button></div>
  </aside>
}

function Hero({ lesson, selected, setSelected }) {
  return <section className="hero"><div className="hero-glow" /><div className="hero-content"><div className="hero-kicker">{lesson ? 'HSK 1' : 'HSK' } <span>•</span> Bài {selected}</div><h1>{lesson?.title ?? '你好，你好！'}</h1><p>{lesson?.subtitle ?? 'Xin chào, xin chào!'}</p><div className="hero-meta"><span>8 từ vựng</span><span>3 điểm ngữ pháp</span><span>7 bài thực hành</span></div></div><div className="hero-actions"><button onClick={() => setSelected(Math.max(1, selected - 1))} aria-label="Bài trước">‹</button><button onClick={() => setSelected(Math.min(lessons.length, selected + 1))} aria-label="Bài sau">›</button></div></section>
}

function Flashcard({ card, index, setIndex }) {
  const [flipped, setFlipped] = useState(false)
  const [playing, setPlaying] = useState(false)
  useEffect(() => setFlipped(false), [index])
  const speak = () => { setPlaying(true); if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(card.han); utterance.lang = 'zh-CN'; utterance.onend = () => setPlaying(false); window.speechSynthesis.speak(utterance) } else setTimeout(() => setPlaying(false), 700) }
  return <div className="study-panel"><div className="panel-heading"><div><h2>Flashcard</h2><p>Học từ vựng qua thẻ ghi nhớ</p></div><div className="pager"><span>{index + 1} <i>/ {flashcards.length}</i></span><button onClick={() => setIndex((index - 1 + flashcards.length) % flashcards.length)}>‹</button><button className="solid" onClick={() => setIndex((index + 1) % flashcards.length)}>›</button></div></div><div className={`flashcard ${flipped ? 'flipped' : ''}`} role="button" tabIndex="0" onClick={() => setFlipped(!flipped)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped(!flipped) }} aria-label="Lật flashcard"><span className="star">☆</span>{flipped ? <><strong className="han small">{card.py}</strong><span className="meaning">{card.meaning}</span><span className="example">{card.example}</span></> : <><strong className="han">{card.han}</strong><span className="pronounce">{card.py}<button className={playing ? 'speaking' : ''} onClick={(e) => { e.stopPropagation(); speak() }}>◖</button></span><span className="meaning">{card.meaning}</span></>}</div><div className="study-actions"><button onClick={() => setFlipped(!flipped)}><Icon>↻</Icon>Lật thẻ</button><button className="primary" onClick={speak}><Icon>{playing ? '◌' : '▶'}</Icon>{playing ? 'Đang phát âm' : 'Nghe phát âm'}</button><button onClick={() => setFlipped(true)}><Icon>☷</Icon>Ví dụ</button></div></div>
}

function ProgressCard({ activeTab, setActiveTab, completed }) {
  return <aside className="progress-card"><div className="progress-head"><div><p>Tiến độ bài học</p><strong>{Math.round((completed / tabs.length) * 100)}<small>%</small></strong></div><span>{completed}/{tabs.length}</span></div><div className="progress-bar"><span style={{ width: `${(completed / tabs.length) * 100}%` }} /></div><div className="progress-list">{tabs.map(([id, icon, label], i) => <button key={id} className={`${activeTab === id ? 'selected' : ''} ${i < completed ? 'complete' : ''}`} onClick={() => setActiveTab(id)}><span className="step">{i < completed ? '✓' : i + 1}</span><Icon>{icon}</Icon><span>{label}</span><small>{i < completed ? 'Đã xong' : i === 0 ? 'Đang học' : `${id === 'grammar' ? 3 : id === 'vocab' ? 8 : 15} câu`}</small></button>)}</div></aside>
}

function LearnPanel({ onComplete }) {
  const [playing, setPlaying] = useState(false)
  const playLesson = () => {
    setPlaying(true)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance('你好！我叫安娜。你叫什么名字？我叫李月。很高兴认识你。')
      utterance.lang = 'zh-CN'; utterance.onend = () => setPlaying(false); window.speechSynthesis.speak(utterance)
    } else setTimeout(() => setPlaying(false), 700)
  }
  return <div className="learn-panel"><div className="learn-heading"><div><span className="section-label">BẮT ĐẦU BÀI HỌC</span><h2>Học bài 1 · 你好，你好！</h2><p>Làm quen với cách chào hỏi và giới thiệu tên bằng tiếng Trung.</p></div><button className="primary listen-lesson" onClick={playLesson}>◉ {playing ? 'Đang đọc bài...' : 'Nghe toàn bài'}</button></div><div className="lesson-goal"><strong>🎯 Mục tiêu bài học</strong><span>Sau bài này, bạn có thể chào hỏi, hỏi tên và nói mình là người nước nào.</span></div><div className="learn-grid"><section className="learn-block"><div className="block-title"><span>01</span><div><h3>Từ mới cần nhớ</h3><small>8 từ · khoảng 5 phút</small></div></div><div className="mini-vocab">{flashcards.slice(0, 6).map(item => <div key={item.han}><strong>{item.han}</strong><span>{item.py}</span><small>{item.meaning}</small></div>)}</div></section><section className="learn-block dialogue"><div className="block-title"><span>02</span><div><h3>Hội thoại mở đầu</h3><small>Đọc theo từng câu</small></div></div><div className="dialogue-lines"><p><b>A</b><span>你好！</span><em>Nǐ hǎo! · Xin chào!</em></p><p><b>B</b><span>你叫什么名字？</span><em>Nǐ jiào shénme míngzi? · Bạn tên là gì?</em></p><p><b>A</b><span>我叫安娜。</span><em>Wǒ jiào Ānnà. · Tôi tên là Anna.</em></p><p><b>B</b><span>很高兴认识你！</span><em>Hěn gāoxìng rènshi nǐ! · Rất vui được gặp bạn!</em></p></div></section></div><div className="learn-bottom"><div><strong>💡 Mẹo học</strong><span>Nghe từng câu 2 lần, sau đó đọc nhại lại theo nhịp.</span></div><button className="complete-button" onClick={onComplete}>✓ Đánh dấu đã học</button></div></div>
}

function Practice({ type }) {
  const items = practice[type]
  const [answers, setAnswers] = useState({})
  const [checked, setChecked] = useState(false)
  const [ordered, setOrdered] = useState([])
  const title = type === 'choice' ? 'Chọn đáp án' : type === 'order' ? 'Sắp xếp câu' : 'Điền đáp án đúng'
  const subtitle = type === 'choice' ? 'Chọn từ phù hợp để hoàn thành câu.' : type === 'order' ? 'Chạm vào các từ theo đúng trật tự.' : 'Điền từ còn thiếu dựa trên gợi ý.'
  return <div className="practice-panel"><div className="practice-title"><div><span className="section-label">PHẦN THỰC HÀNH</span><h2>{title}</h2><p>{subtitle}</p></div><span className="question-count">{items.length} câu mẫu <small>/ 15</small></span></div><div className="questions">{items.map((item, i) => <div className="question" key={i}><div className="question-top"><span className="q-number">{String(i + 1).padStart(2, '0')}</span><strong>{item.q}</strong></div>{type === 'choice' && <div className="options">{item.options.map((option, j) => <button key={option} className={`${answers[i] === j ? 'picked' : ''} ${checked && j === item.answer ? 'correct' : ''}`} onClick={() => setAnswers({ ...answers, [i]: j })}>{String.fromCharCode(65 + j)}. {option}</button>)}</div>}{type === 'order' && <><div className="order-result">{(answers[i] || []).map(word => <span key={word}>{word}</span>)}</div><div className="word-bank">{item.words.map(word => <button key={word} disabled={(answers[i] || []).includes(word)} onClick={() => setAnswers({ ...answers, [i]: [...(answers[i] || []), word] })}>{word}</button>)}</div></>}{type === 'fill' && <><p className="hint">{item.hint}</p><input value={answers[i] || ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Nhập đáp án tiếng Trung" /></>}</div>)}</div><div className="practice-footer"><button className="ghost" onClick={() => { setAnswers({}); setChecked(false) }}>Làm lại</button><button className="primary" onClick={() => setChecked(true)}>Kiểm tra đáp án <span>→</span></button>{checked && <span className="score">✓ Đã kiểm tra</span>}</div></div>
}

function LessonContent({ activeTab, setActiveTab, card, index, setIndex, selected }) {
  if (activeTab === 'learn') return <LearnPanel onComplete={() => setActiveTab('flashcard')} />
  if (['choice', 'order', 'fill'].includes(activeTab)) return <Practice type={activeTab} />
  if (activeTab === 'grammar') return <div className="content-panel info-panel"><span className="section-label">ÔN TẬP</span><h2>Ngữ pháp trọng tâm</h2><div className="grammar-row"><strong>1</strong><div><h3>Câu hỏi với 吗 (ma)</h3><p>Thêm 吗 vào cuối câu kể để biến câu thành câu hỏi Yes/No.</p><div className="formula">你好吗？ <span>Nǐ hǎo ma?</span> <em>Bạn khỏe không?</em></div></div></div><div className="grammar-row"><strong>2</strong><div><h3>Cấu trúc “A 是 B”</h3><p>Dùng 是 để giới thiệu hoặc xác nhận danh tính.</p><div className="formula">我是学生。 <span>Wǒ shì xuésheng.</span> <em>Tôi là học sinh.</em></div></div></div></div>
  if (activeTab === 'vocab') return <div className="content-panel info-panel"><span className="section-label">ÔN TẬP</span><h2>Tổng hợp từ vựng bài {selected}</h2><div className="vocab-grid">{flashcards.map(item => <button key={item.han} onClick={() => setActiveTab('flashcard')}><strong>{item.han}</strong><span>{item.py}</span><small>{item.meaning}</small></button>)}</div></div>
  if (activeTab === 'reading') return <div className="content-panel reading-panel"><span className="section-label">PHẦN THỰC HÀNH</span><h2>Bài khóa · 你好，你好！</h2><div className="reading-text"><p><strong>你好！</strong> 我叫安娜。你叫什么名字？</p><p><strong>我叫李月。</strong> 你是哪国人？</p><p>我是越南人。你呢？</p></div><button className="primary" onClick={() => window.speechSynthesis?.speak(Object.assign(new SpeechSynthesisUtterance('你好！我叫安娜。你叫什么名字？'), { lang: 'zh-CN' }))}>▶ Nghe bài khóa</button></div>
  return <Flashcard card={card} index={index} setIndex={setIndex} />
}

function App() {
  const [level, setLevel] = useState(levels[0]); const [selected, setSelected] = useState(1); const [activeTab, setActiveTab] = useState('learn'); const [index, setIndex] = useState(0)
  const lesson = useMemo(() => lessons.find(item => item.id === selected), [selected]); const completed = activeTab === 'learn' ? 0 : activeTab === 'flashcard' ? 2 : ['grammar', 'vocab'].includes(activeTab) ? 3 : 4
  const goTab = tab => { setActiveTab(tab); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return <div className="app-shell"><Sidebar level={level} setLevel={setLevel} selected={selected} setSelected={id => { setSelected(id); setActiveTab('learn'); setIndex(0) }} /><main className="main"><div className="mobile-top"><button>☰</button><strong>Tiếng Trung Giang Giang</strong><button>⌕</button></div><Hero lesson={lesson} selected={selected} setSelected={setSelected} /><nav className="tabs" aria-label="Nội dung bài học">{tabs.map(([id, icon, label]) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => goTab(id)}><Icon>{icon}</Icon><span>{label}</span></button>)}</nav><div className="workspace"><LessonContent activeTab={activeTab} setActiveTab={goTab} card={flashcards[index]} index={index} setIndex={setIndex} selected={selected} /><ProgressCard activeTab={activeTab} setActiveTab={goTab} completed={completed} /></div></main><div className="toast"><span>✦</span><div><strong>Học 10 phút mỗi ngày</strong><small>Tiến bộ nhỏ, kết quả lớn.</small></div><button>×</button></div></div>
}

createRoot(document.getElementById('root')).render(<App />)
