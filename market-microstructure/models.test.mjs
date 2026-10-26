import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_ASKS, matchBook, optionsRace, mevScenario } from './models.mjs';

test('FIFO allocates earlier order first; pro rata splits the same price proportionally', () => {
  assert.deepEqual(matchBook(50, 10100).fills.map(f => f.quantity), [30, 20]);
  assert.deepEqual(matchBook(50, 10100, 'pro-rata').fills.map(f => f.quantity), [15, 35]);
  assert.equal(INITIAL_ASKS[0].quantity, 30);
});
test('price priority, limit protection, and quantity conservation hold across the sweep', () => {
  for (const policy of ['fifo', 'pro-rata']) for (const limit of [10000, 10100, 10200]) for (let n = 1; n <= 200; n++) {
    const r = matchBook(n, limit, policy);
    assert.equal(r.filled + r.remaining, n);
    assert.equal(r.book.reduce((sum, o) => sum + o.quantity, 0) + r.filled, 150);
    assert(r.book.every(o => o.quantity >= 0));
    assert(r.fills.every(f => f.price <= limit && Number.isInteger(f.quantity)));
    assert(r.fills.every((f, i) => !i || r.fills[i - 1].price <= f.price));
  }
});
test('options race models both outcomes and declares a deterministic tie', () => {
  assert.equal(optionsRace(50, 300).staleFill, false);
  assert.equal(optionsRace(500, 300).staleFill, true);
  assert.equal(optionsRace(200, 300).staleFill, false);
  assert(Math.abs(optionsRace(500, 300).makerMarkout + 45) < 1e-9);
});
test('AMM default sequence worsens output and returns positive pre-gas surplus', () => {
  const r = mevScenario();
  assert(r.userExecuted);
  assert(r.outputShortfall > 0);
  assert(r.searcherGross > 0);
  assert(r.sequence.every(s => s.quote > 0 && s.token > 0));
  assert(r.sequence[2].quote * r.sequence[2].token >= r.initial.quote * r.initial.token);
});
test('tight minimum output reverts the user and removes their pool state change', () => {
  const r = mevScenario(0.1);
  assert.equal(r.userExecuted, false);
  assert.equal(r.sequence[1].quote, r.sequence[0].quote);
  assert.equal(r.sequence[1].token, r.sequence[0].token);
  assert(r.searcherGross < 0); // fee cost of the remaining round trip
});
test('without a preceding trade the user gets the baseline result', () => {
  const r = mevScenario(0, 0);
  assert(r.userExecuted);
  assert.equal(r.outputShortfall, 0);
  assert.equal(r.searcherGross, 0);
});
