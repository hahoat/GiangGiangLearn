import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toneOf, pairSyllables, segment, schedule, streakOf, dayKey, setGlossary } from '../src/lib/chinese.js'

setGlossary(JSON.parse(readFileSync(new URL('../public/content/glossary.json', import.meta.url))))

assert.deepEqual(['mā', 'má', 'mǎ', 'mà', 'ma'].map(toneOf), [1, 2, 3, 4, 5])
assert.deepEqual(pairSyllables('你好', 'nǐ hǎo').map(g => g.tone), [3, 3])
assert.deepEqual(pairSyllables('面条儿', 'miàn tiáor').map(g => g.py), ['miàn', 'tiáor', ''])
assert.deepEqual(pairSyllables('女儿', 'nǚ ér').map(g => g.py), ['nǚ', 'ér'])
assert.deepEqual(segment('我是越南人。').map(t => t.text), ['我', '是', '越南人', '。'])
assert.deepEqual(segment('你叫什么名字？').map(t => t.text), ['你', '叫', '什么', '名字', '？'])

const now = 0, DAY = 86400000
assert.equal(schedule(undefined, 'good', now).due, DAY)
assert.equal(schedule({ ivl: 4, reps: 2 }, 'good', now).ivl, 10)
assert.equal(schedule({ ivl: 4, reps: 2 }, 'again', now).ivl, 0)

const today = new Date(2026, 9, 31)
const d = n => { const x = new Date(today); x.setDate(x.getDate() - n); return dayKey(x) }
assert.equal(streakOf({ [d(0)]: 5, [d(1)]: 3, [d(3)]: 1 }, today), 2)
assert.equal(streakOf({ [d(1)]: 3, [d(2)]: 3 }, today), 2)
assert.equal(streakOf({}, today), 0)
console.log('chinese helpers test passed')
