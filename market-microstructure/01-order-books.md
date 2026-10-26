# Part 1 — Order books: price, quantity, and priority

[Overview](README.md) · Next: [Options market makers](02-options-market-makers.md)

An order book records outstanding intentions to trade. The matching engine consumes a sequence of commands and decides which intentions become executions. Keeping those separate helps: displaying a price ladder is easier than implementing all the rules behind it.

## Read the book

A bid is a purchase offer; an ask is a sale offer. The highest bid and lowest ask are the best prices. Their difference is the spread. Quantities available beyond those prices form the depth.

Our fictional resting sell orders are:

| Arrival sequence | Seller | Price | Quantity |
| --- | --- | --- | --- |
| 1 | Alice | $101 | 30 |
| 2 | Bob | $101 | 70 |
| 3 | Carol | $102 | 50 |

Assume the best bid is $100. A buy limit of $101 can consume Alice and Bob, but not Carol. A limit is a worst acceptable price: an incoming buy limit of $102 still consumes the $101 orders first under the illustrated price-priority policy.

A market order seeks immediate execution without a user-specified limit price, subject to venue protections. It does not guarantee unlimited liquidity. A limit order can also execute immediately when it crosses eligible opposite-side interest. “Market” and “taker” are therefore different concepts: a marketable limit order can take liquidity.

## Allocate at a price

**FIFO / price-time.** Among equally eligible orders at the same price, earlier ones fill first. Buying 50 at $101 gives Alice 30 fills and Bob 20. Queue position matters even though both quote the same price. Coinbase Derivatives describes a price-time FIFO policy. [Coinbase matching documentation](https://help.coinbase.com/en/derivatives/features/order-matching)

**Proportional allocation.** A simplified pro-rata rule divides 50 according to resting size: Alice receives 15 and Bob 35. Whole-unit rounding requires a second rule. This lab floors allocations, then assigns leftover units by largest fractional remainder, breaking ties by arrival sequence. This is our teaching policy; CME’s documented algorithms have their own allocation steps and minimums. [CME allocation steps](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/457218521)

**Hybrids.** A venue can combine FIFO, proportional allocation, and eligibility-based priority. CME documents several such algorithm families. A claim about “the queue” is incomplete until the applicable product rules are known. [CME overview](https://www.cmegroup.com/education/matching-algorithm-overview)

Try quantity **101** at a $102 limit: both policies must exhaust all 100 units at $101 before taking one from Carol. Allocation differs within a price level, not by skipping a better eligible price.

## Decide when to match

Continuous matching processes eligible orders as commands arrive in the engine’s sequence. An auction accumulates interest, then determines an execution price and allocates eligible quantities at the crossing event.

For a toy single-price auction, at each candidate price `p`:

```text
buy interest(p)  = quantity of buys with limits >= p
sell interest(p) = quantity of sells with limits <= p
executable(p)    = min(buy interest(p), sell interest(p))
```

A possible first objective is maximizing executable quantity. Multiple prices can tie, so imbalance, reference-price tie-breakers, and price constraints must be specified. Nasdaq’s documented crosses provide a real example of these additional decisions. This folder explains auctions but does not implement a venue auction algorithm. [Nasdaq cross methodology](https://www.nasdaqtrader.com/content/ProductsServices/Trading/Crosses/openclose_faqs.pdf)

## Decide what participants see

A top-of-book view shows best quotes. An aggregated depth view combines quantity at each price. An order-level view distinguishes individual orders, subject to the feed’s publication rules. These are views of matching state, not competing matching algorithms.

Displayed interest may also be only part of total eligible interest. Hidden and iceberg orders introduce visibility and priority rules. Coinbase Markets, for example, documents price-display-time priority; its hidden-interest treatment should not be generalized to every venue. [Coinbase trading rules](https://www.coinbase.com/legal/trading_rules)

## Build a deterministic engine

A proposed implementation for a simple FIFO engine would use an ordered map of price levels, a linked queue at each level, and an order-ID index for cancellations. Store money as integer ticks, not floating-point prices. Sequence commands authoritatively and record accepted changes as events.

Important policies extend beyond matching:

- Does increasing an order’s size lose time priority? What about changing price?
- Does an unfilled remainder rest, cancel immediately, or require full execution?
- How are self-trades prevented?
- Is a cancellation acknowledged only after it has changed matching state?
- Can replay reconstruct identical orders, trades, and balances after a restart?

The interactive lab deliberately covers only an incoming **immediate-or-cancel buy** against the fixed ask fixture. Unfilled quantity cancels; it never appears as a new bid. It shows every fill at the resting price and keeps quantities conserved. It omits fees, hidden interest, account risk, amendments, and continuous external arrivals.

The bridge to Part 2 is the cancellation question: deciding to change a quote and actually changing it at the exchange are two different events.
