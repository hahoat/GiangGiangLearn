import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => JSON.parse(readFileSync(new URL(`../public/content/${p}`, import.meta.url)))
const index = read('index.json')
assert.equal(index.length, 11, '11 cấp: HSK 1–5, YCT 1–6')
const hsk1 = index.find(c => c.id === 'hsk1')
assert.equal(hsk1.lessons.length, 16)
for (const { id } of hsk1.lessons) {
  const l = read(`hsk1/${id}.json`)
  assert.equal(l.practice.choice.length, 15, `bài ${id}: 15 câu chọn`)
  assert.equal(l.practice.order.length, 15, `bài ${id}: 15 câu sắp xếp`)
  assert.equal(l.practice.fill.length, 15, `bài ${id}: 15 câu điền`)
  assert.ok(l.vocab.length >= 10 && l.grammar.length >= 2 && l.texts.length >= 1, `bài ${id}: đủ phần ôn tập`)
  for (const q of l.practice.choice) assert.equal(q.options.length, 4)
  for (const q of l.practice.order) assert.notDeepEqual(q.words, q.answer)
}
console.log('content test passed: 16 bài × 45 câu')
