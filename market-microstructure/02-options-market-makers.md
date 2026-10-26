# Part 2 — Options market makers: speed, information, and order flow

Previous: [Order books](01-order-books.md) · [Overview](README.md) · Next: [MEV](03-mev-and-crypto.md)

“Market makers have faster order flow” combines several different advantages. Separate them before drawing conclusions about who sees what, who is allowed to trade, or why a particular fill occurred.

## Four mechanisms worth distinguishing

| Mechanism | What can be faster or different | What it does not establish |
| --- | --- | --- |
| Market-data path | Receiving exchange or underlying-market updates | Knowledge of every pending customer order |
| Computation | Updating many option quotes and risk estimates | Accurate knowledge of future prices |
| Order-entry path | Delivering a quote replacement, cancel, hedge, or new order | Guaranteed engine priority over an earlier accepted command |
| Order-flow relationship | Receiving orders routed through a broker or consolidator | Universal access to all brokers’ order flow |

Exchange connectivity and feed infrastructure are real technical components; Cboe publishes specifications for them. Whether a specific firm is faster requires synchronized measurements of the relevant paths. This folder uses invented times rather than claiming a measured market-wide latency advantage. [Cboe connectivity manual](https://www.cboe.com/document/tech-spec/document/technical-specifications/cboe-titanium-u.s.-equitiesoptions-connectivity-manual)

## Why the underlying matters

An option’s modeled value depends on more than its own latest trade. Delta describes local sensitivity to an underlying-price change, holding other conditions constant. [Options Industry Council: option price behavior](https://www.optionseducation.org/referencelibrary/faq/option-price-behavior)

Our synthetic call starts with model fair value $2.00, an ask of $2.05, and delta 0.50. A $1 increase in the underlying changes the model estimate by:

```text
approximate option change = delta × underlying change
                          = 0.50 × $1.00
                          = $0.50
new model fair value      = $2.50
```

This is a local linear illustration. It freezes delta, implied volatility, time, rates, dividends, and inventory effects. It does not compute a full option price. A real model must account for changing sensitivities and other inputs; the lab’s $2.50 is a stipulated model reference, not an executable market price.

## The quote-update race

Suppose a resting ask still offers one contract at $2.05. The maker tries to replace it at $2.55. Meanwhile, a buy limit of $2.05 is traveling to the exchange.

The lab separates three maker delays:

```text
underlying event
  + feed delay
  + 20 μs calculation time
  + 80 μs outbound path
  = quote-replacement arrival at exchange
```

Compare that time with the incoming buy’s exchange arrival:

- If the replacement is processed first, the old ask disappears. The buy’s $2.05 limit cannot cross the new $2.55 ask, so it does not fill in this fixture.
- If the buy is processed first, it fills the old ask. A later replacement cannot erase that execution.
- If times tie, the lab processes replacement first as an explicit toy tie-breaker. Actual engine sequencing rules determine real ties.

With a $2.05 fill against a $2.50 model reference and an assumed 100-unit multiplier, the maker’s immediate signed markout is `(2.05 − 2.50) × 100 = −$45`. That is a model-relative value difference, not a complete realized P&L calculation. It excludes the premium’s relationship to prior inventory, hedges, fees, and subsequent price changes. Contract multipliers and deliverables can vary; 100 is a scenario assumption.

Faster processing can help a maker avoid such stale fills. It can also let another participant reach a stale quote before replacement. Fast arrival alone does not identify the participant’s role or explain the quality of their information.

## Routing relationships are a different question

A broker or consolidator may handle customer orders before routing them to an exchange. SEC Rule 606 guidance discusses options-order routing, consolidators, and payment-for-order-flow disclosures. This is a reason to inspect the actual routing chain, not evidence that every market maker sees all customer orders. [SEC options routing FAQ](https://www.sec.gov/rules-regulations/staff-guidance/trading-markets-frequently-asked-questions/faq-rule-606-regulation)

Some options mechanisms allow a paired agency/contra order to enter an exchange price-improvement auction. Cboe describes AIM as an auction with potential price improvement and a participation right. That is a defined execution mechanism, separate from a generic latency advantage. [Cboe crossing orders](https://www.cboe.com/markets/us/options/trading/crossing-orders/)

To investigate a real claim, ask: which broker, which order, which venue, which feed, and which event timestamps? Receiving a routed order, receiving a public update first, and responding faster to an auction are different observations.

## What to measure

Record the underlying event, feed receipt, decision completion, outbound message, exchange acceptance, execution, and acknowledgment. A local send timestamp alone cannot locate an order in the exchange sequence. Across machines, clock offset and timestamp meaning must be documented before comparing microseconds.

The interactive race assumes a single venue, one resting ask, one incoming buy, and an atomic quote replacement. It omits queueing variability, partial fills, multiple strikes, competing quotes, auction eligibility, hedging, and risk limits. Changing its sliders is a thought experiment about event ordering, not a calibration to a named firm.

Part 3 moves from changing an order’s position in an exchange sequence to choosing the sequence of state-changing blockchain transactions.
