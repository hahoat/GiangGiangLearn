export const levels = [
  { id: 'HSK1', label: 'HSK 1', lessons: 15, words: 150, accent: '#d94b3f' },
  { id: 'HSK2', label: 'HSK 2', lessons: 15, words: 150, accent: '#d78b3a' },
  { id: 'HSK3', label: 'HSK 3', lessons: 20, words: 300, accent: '#4a8b78' },
  { id: 'HSK4', label: 'HSK 4', lessons: 20, words: 600, accent: '#5b6ba8' }
]

export const lessons = [
  { id: 1, title: '你好，你好！', subtitle: 'Xin chào, xin chào!', words: 8, done: 3 },
  { id: 2, title: '我叫李月', subtitle: 'Tôi tên là Lý Nguyệt', words: 10, done: 0 },
  { id: 3, title: '你是哪国人？', subtitle: 'Bạn là người nước nào?', words: 12, done: 0 },
  { id: 4, title: '我有两个孩子', subtitle: 'Tôi có hai người con', words: 14, done: 0 },
  { id: 5, title: '今天我很忙', subtitle: 'Hôm nay tôi rất bận', words: 11, done: 0 },
  { id: 6, title: '你的手机号码是多少？', subtitle: 'Số điện thoại của bạn là bao nhiêu?', words: 13, done: 0 },
  { id: 7, title: '我想喝茶', subtitle: 'Tôi muốn uống trà', words: 12, done: 0 },
  { id: 8, title: '我喜欢中国菜', subtitle: 'Tôi thích món ăn Trung Quốc', words: 14, done: 0 }
]

export const flashcards = [
  { han: '你好', py: 'nǐ hǎo', meaning: 'xin chào', example: '你好！很高兴认识你。' },
  { han: '我', py: 'wǒ', meaning: 'tôi, mình', example: '我是越南人。' },
  { han: '叫', py: 'jiào', meaning: 'gọi là, tên là', example: '我叫安娜。' },
  { han: '你', py: 'nǐ', meaning: 'bạn', example: '你好吗？' },
  { han: '好', py: 'hǎo', meaning: 'tốt, khỏe', example: '我很好，谢谢。' },
  { han: '谢谢', py: 'xiè xie', meaning: 'cảm ơn', example: '谢谢你！' },
  { han: '再见', py: 'zài jiàn', meaning: 'tạm biệt', example: '明天再见！' },
  { han: '老师', py: 'lǎo shī', meaning: 'giáo viên', example: '她是我的老师。' }
]

export const practice = {
  choice: [
    { q: '你___？', options: ['好', '叫', '我', '是'], answer: 0 },
    { q: '我___明明。', options: ['好', '叫', '你', '不'], answer: 1 },
    { q: '谢谢___。', options: ['我', '好', '你', '老师'], answer: 2 }
  ],
  order: [
    { words: ['是', '我', '越南人'], answer: ['我', '是', '越南人'] },
    { words: ['叫', '你', '什么'], answer: ['你', '叫', '什么'] },
    { words: ['很', '高兴', '认识', '你'], answer: ['很', '高兴', '认识', '你'] }
  ],
  fill: [
    { q: '我___李月。', hint: 'Tôi tên là Lý Nguyệt', answer: '叫' },
    { q: '你___好？', hint: 'Bạn khỏe không?', answer: '好' },
    { q: '我___越南人。', hint: 'Tôi là người Việt Nam.', answer: '是' }
  ]
}
