import assert from 'node:assert/strict'
import { flashcards, levels, lessons, practice } from '../src/data.js'

assert.equal(levels.length, 4)
assert.equal(lessons[0].title, '你好，你好！')
assert.equal(flashcards[0].han, '你好')
assert.equal(practice.choice.length, 3)
console.log('data smoke test passed')
