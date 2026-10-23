import assert from 'node:assert/strict'
import { attentionOrder, attentionScore } from '../src/utils/attentionOrder.js'

const cell = (index, columns) => 'ABCDE'[index % columns] + (Math.floor(index / columns) + 1)

// The inverted L on a 5×5 grid: top row and left column first, bottom-right last.
const order = attentionOrder(25, 5).map(index => cell(index, 5))
assert.deepEqual(order.slice(0, 7), ['A1', 'B1', 'A2', 'C1', 'A3', 'D1', 'E1'])
assert.equal(order[0], 'A1')
assert.equal(order.at(-1), 'E5')
// Ends of the arms beat the first interior cell.
assert.ok(attentionScore(4, 0) > attentionScore(1, 1))
assert.ok(attentionScore(0, 3) > attentionScore(1, 1))

// One column (phones) is plain top-to-bottom order.
assert.deepEqual(attentionOrder(4, 1), [0, 1, 2, 3])
// A partly filled last row still ranks every item once.
assert.deepEqual([...attentionOrder(7, 3)].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6])
// Bad column counts fall back to one column.
assert.deepEqual(attentionOrder(3, 0), [0, 1, 2])

console.log('attention order tests passed')
