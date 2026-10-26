/** Pure, deterministic teaching models. No live market connectivity. */
export const INITIAL_ASKS = [
  { id: 'Alice', price: 10100, quantity: 30 },
  { id: 'Bob', price: 10100, quantity: 70 },
  { id: 'Carol', price: 10200, quantity: 50 },
];

export function matchBook(quantity, limit, policy = 'fifo') {
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(limit)) throw new Error('Use positive integer quantity and integer price ticks');
  if (!['fifo', 'pro-rata'].includes(policy)) throw new Error('Unknown matching policy');
  const book = INITIAL_ASKS.map(order => ({ ...order }));
  const fills = [];
  let remaining = quantity;
  for (const price of [...new Set(book.map(order => order.price))].sort((a, b) => a - b)) {
    if (price > limit || !remaining) break;
    const orders = book.filter(order => order.price === price);
    const total = orders.reduce((sum, order) => sum + order.quantity, 0);
    const available = Math.min(remaining, total);
    let allocations;
    if (policy === 'fifo') {
      let left = available;
      allocations = orders.map(order => { const n = Math.min(left, order.quantity); left -= n; return n; });
    } else {
      // Largest remainder allocation; equal remainders use original order sequence.
      // Deliberately a teaching rule, not a reproduction of a venue's algorithm.
      allocations = orders.map(order => Math.floor(available * order.quantity / total));
      let left = available - allocations.reduce((a, b) => a + b, 0);
      const ranking = orders.map((order, i) => ({ i, remainder: available * order.quantity % total }))
        .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
      for (const entry of ranking) { if (!left) break; allocations[entry.i]++; left--; }
    }
    orders.forEach((order, i) => {
      if (!allocations[i]) return;
      order.quantity -= allocations[i];
      remaining -= allocations[i];
      fills.push({ maker: order.id, quantity: allocations[i], price });
    });
  }
  const filled = quantity - remaining;
  const cost = fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0);
  return { fills, remaining, book, filled, cost, average: filled ? cost / filled : null };
}

export function optionsRace(feedUs, orderUs, stockMove = 1) {
  if (![feedUs, orderUs, stockMove].every(Number.isFinite) || feedUs < 0 || orderUs < 0 || stockMove < 0) throw new Error('Inputs must be finite and nonnegative');
  const computeUs = 20, routeUs = 80;
  const updateUs = feedUs + computeUs + routeUs;
  const oldFair = 2, oldAsk = 2.05, delta = 0.5;
  const newFair = oldFair + delta * stockMove;
  const newAsk = newFair + 0.05;
  // Explicit teaching tie-break: quote update precedes buy if timestamps tie.
  const staleFill = orderUs < updateUs;
  const events = [
    { time: 0, event: 'Underlying moves; model fair value changes' },
    { time: feedUs, event: 'Market maker receives underlying update' },
    { time: updateUs, event: 'Exchange applies atomic quote replacement', rank: 0 },
    { time: orderUs, event: 'Buy limit $2.05 reaches exchange', rank: 1 },
  ].sort((a, b) => a.time - b.time || (a.rank ?? -1) - (b.rank ?? -1));
  return { updateUs, orderUs, oldAsk, newAsk, newFair, staleFill, events,
    makerMarkout: staleFill ? (oldAsk - newFair) * 100 : 0 };
}

function buy(pool, quote) {
  const effective = quote * (1 - pool.fee);
  const tokens = pool.token * effective / (pool.quote + effective);
  pool.quote += quote;
  pool.token -= tokens;
  return tokens;
}
function sell(pool, tokens) {
  const effective = tokens * (1 - pool.fee);
  const quote = pool.quote * effective / (pool.token + effective);
  pool.token += tokens;
  pool.quote -= quote;
  return quote;
}

export function mevScenario(slippagePercent = 5, precedingBuy = 2000) {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent > 100 || !Number.isFinite(precedingBuy) || precedingBuy < 0) throw new Error('Invalid AMM inputs');
  const initial = { quote: 100000, token: 1000, fee: 0.003 };
  const userInput = 10000;
  const baselinePool = { ...initial };
  const baselineOutput = buy(baselinePool, userInput);
  const minimumOutput = baselineOutput * (1 - slippagePercent / 100);
  const pool = { ...initial };
  const sequence = [];
  const searcherTokens = buy(pool, precedingBuy);
  sequence.push({ label: 'Preceding purchase', quote: pool.quote, token: pool.token });
  const candidate = { ...pool };
  const proposedOutput = buy(candidate, userInput);
  const userExecuted = proposedOutput >= minimumOutput;
  if (userExecuted) Object.assign(pool, candidate);
  sequence.push({ label: userExecuted ? 'User purchase executes' : 'User purchase reverts; pool unchanged', quote: pool.quote, token: pool.token });
  const returnedQuote = sell(pool, searcherTokens);
  sequence.push({ label: 'Subsequent sale', quote: pool.quote, token: pool.token });
  return { baselineOutput, minimumOutput, proposedOutput, userExecuted,
    userOutput: userExecuted ? proposedOutput : 0,
    outputShortfall: userExecuted ? baselineOutput - proposedOutput : null,
    searcherGross: returnedQuote - precedingBuy, sequence, userInput, initial };
}
