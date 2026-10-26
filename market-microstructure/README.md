# Market microstructure: a three-part deep dive

One connected explanation of **who trades, at what price, and in what order**:

1. [Order books and matching](01-order-books.md): liquidity, queues, allocation, visibility, and engine design.
2. [Options market makers, latency, and order flow](02-options-market-makers.md): quote updates, stale prices, routing relationships, and the limits of a speed advantage.
3. [MEV and crypto](03-mev-and-crypto.md): AMMs, transaction ordering, arbitrage, sandwich losses, and mitigation tradeoffs.

Read the chapters in order, or use the interactive page to compare the mechanisms. These are three parts of the same deep dive, all maintained in this folder.

## Open the interactive illustrations

From the repository root, using Python 3:

```bash
python3 -m http.server 8001 --bind 127.0.0.1 --directory market-microstructure
```

Open **http://127.0.0.1:8001**. Stop with Ctrl+C. There is no installation or build step. The page uses JavaScript modules, so serve it over HTTP rather than opening the HTML directly.

The three illustrations are:

- **Matching lab:** change the incoming buy quantity and limit; compare FIFO with proportional allocation. Inspect individual fills and the remaining book.
- **Options race:** change the market maker’s feed delay and the incoming order’s arrival time. Observe whether a quote replacement or the order wins at the exchange.
- **MEV lab:** compare a standalone pool swap with a surrounding purchase/sale sequence. Change the minimum-output tolerance and inspect whether the user executes or reverts.

All inputs and results are synthetic, deterministic local calculations. The page has no wallet connection, market feed, transaction submission, analytics, or external dependencies. It is an explanatory model rather than a trading system or performance benchmark.

## How the pieces connect

| Part | Shared state | Sequencing authority | What order can change |
| --- | --- | --- | --- |
| Order book | Orders and price-level queues | Matching engine | Which resting order fills |
| Options race | Live quote and modeled fair value | Venue event sequence | Whether an old quote fills before replacement |
| Crypto MEV | Pool reserves and contract state | Block construction / chain ordering | Execution price and distribution of value |

Lower latency can matter in all three, but it does not override their rules. Sending HTTP requests close together does not establish queue priority, guarantee a quote cancellation, or control block ordering.

## Implementation and validation

- `index.html`, `styles.css`, `app.mjs`: a responsive, keyboard-accessible reading page with three interactive labs. Results are announced when controls change.
- `models.mjs`: pure calculation functions, independent of the UI.
- `models.test.mjs`: allocation invariants, quote-race outcomes, and AMM accounting scenarios.
- `01-…md` through `03-…md`: detailed chapters with primary-source references and model limitations.

Run the model tests with **Node.js 18+**:

```bash
node --test market-microstructure/models.test.mjs
```

The book uses integer price ticks and quantities. The AMM and option examples use floating-point arithmetic for illustration; they do not reproduce contract fixed-point rounding or a production options pricing system. There are no package dependencies.
