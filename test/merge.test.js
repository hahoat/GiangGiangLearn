import assert from 'node:assert/strict'
import { mergeState } from '../src/lib/merge.js'

const local = { progress: { 'hsk1-1': ['lecture', 'flashcard'] }, srs: { 你: { ivl: 1, t: 200 }, 好: { ivl: 4, t: 50 } }, log: { d1: 10, d2: 5 } }
const remote = { progress: { 'hsk1-1': ['flashcard', 'grammar'], 'hsk1-2': ['lecture'] }, srs: { 你: { ivl: 9, t: 100 }, 好: { ivl: 2, t: 90 } }, log: { d1: 30 } }
const m = mergeState(local, remote)
assert.deepEqual(new Set(m.progress['hsk1-1']), new Set(['lecture', 'flashcard', 'grammar']))
assert.deepEqual(m.progress['hsk1-2'], ['lecture'])
assert.equal(m.srs.你.ivl, 1, 'giữ bản ôn gần nhất (máy này)')
assert.equal(m.srs.好.ivl, 2, 'giữ bản ôn gần nhất (tài khoản)')
assert.deepEqual(m.log, { d1: 30, d2: 5 })
assert.deepEqual(mergeState({}, {}), { progress: {}, srs: {}, log: {} })
console.log('merge test passed')
