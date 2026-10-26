import { INITIAL_ASKS, matchBook, optionsRace, mevScenario } from './models.mjs';
const $ = selector => document.querySelector(selector);
const fixed = (n, digits = 3) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = ticks => '$' + fixed(ticks / 100, 2);
function row(values) {
  const tr = document.createElement('tr');
  for (const value of values) {
    const td = document.createElement('td');
    td.textContent = String(value);
    tr.append(td);
  }
  return tr;
}
function renderBook() {
  const input = $('#quantity');
  if (!input.validity.valid) {
    $('#book-result').textContent = 'Enter a whole-unit quantity from 1 to 200; the table shows the last valid calculation.';
    return;
  }
  const result = matchBook(Number(input.value), Number($('#limit').value), $('#policy').value);
  $('#book-rows').replaceChildren(...result.book.map((o, i) => row([o.id, money(o.price), INITIAL_ASKS[i].quantity, o.quantity])));
  $('#fills').replaceChildren();
  for (const fill of result.fills) {
    const li = document.createElement('li');
    li.textContent = `${fill.maker}: ${fill.quantity} at ${money(fill.price)}`;
    $('#fills').append(li);
  }
  if (!result.fills.length) {
    const li = document.createElement('li');
    li.textContent = 'No eligible sell price crosses this limit.';
    $('#fills').append(li);
  }
  $('#book-result').textContent = `${result.filled} filled; ${result.remaining} unfilled units canceled. ` +
    (result.average === null ? 'No execution price.' : `Average price ${money(result.average)}; total cost ${money(result.cost)} before fees.`);
}
function renderOptions() {
  const feed = Number($('#feed').value), arrival = Number($('#arrival').value);
  $('#feed-value').value = `${feed} μs`;
  $('#arrival-value').value = `${arrival} μs`;
  const r = optionsRace(feed, arrival);
  $('#race-events').replaceChildren(...r.events.map(event => {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = `${event.time} μs`;
    const text = document.createElement('span');
    text.textContent = event.event;
    li.append(time, text);
    return li;
  }));
  $('#race-result').textContent = r.staleFill
    ? `Buy wins at ${arrival} μs, before replacement at ${r.updateUs} μs. One contract fills at $2.05 versus $2.50 model value. Maker markout: $${fixed(r.makerMarkout, 2)}, excluding hedges and fees.`
    : `Replacement wins at ${r.updateUs} μs. The ask is $2.55 when the $2.05-limit buy is processed at ${arrival} μs. No fill; no executed-position markout.`;
}
function renderMev() {
  const preceding = Number($('#preceding').value), slippage = Number($('#slippage').value);
  $('#preceding-value').value = fixed(preceding, 0);
  $('#slippage-value').value = `${fixed(slippage, 1)}%`;
  const r = mevScenario(slippage, preceding);
  $('#baseline').textContent = fixed(r.baselineOutput);
  $('#user-output').textContent = r.userExecuted ? fixed(r.userOutput) : 'REVERTED';
  $('#user-caption').textContent = r.userExecuted ? 'tokens received' : 'no swap transfers applied';
  $('#surplus').textContent = fixed(r.searcherGross, 2);
  $('#pool-rows').replaceChildren(...r.sequence.map(s => row([s.label, fixed(s.quote), fixed(s.token)])));
  $('#mev-result').textContent = `User minimum: ${fixed(r.minimumOutput)} tokens. Changed-pool quote: ${fixed(r.proposedOutput)}. ` +
    (r.userExecuted ? `The swap executes with ${fixed(r.outputShortfall)} fewer tokens than the standalone baseline.`
      : 'The user swap rejects. Without that intervening purchase, the surrounding round trip cannot capture its price impact and pays pool fees.');
}
$('#book-controls').addEventListener('submit', event => event.preventDefault());
for (const id of ['#quantity', '#limit', '#policy']) $(id).addEventListener('input', renderBook);
for (const id of ['#feed', '#arrival']) $(id).addEventListener('input', renderOptions);
for (const id of ['#preceding', '#slippage']) $(id).addEventListener('input', renderMev);
renderBook();
renderOptions();
renderMev();
