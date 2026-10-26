# Part 3 — MEV: when transaction ordering has a price

Previous: [Options market makers](02-options-market-makers.md) · [Overview](README.md)

MEV means maximal extractable value: value obtainable through transaction inclusion, exclusion, and ordering beyond ordinary block compensation. Searchers identify opportunities; block construction determines their placement. Examples include arbitrage, liquidations, and sandwiching, with different effects on other participants. [Ethereum MEV guide](https://ethereum.org/developers/docs/mev/)

The connection to the earlier parts is shared state. An order book changes when orders execute. A quote race changes whether an old price is still available. A blockchain pool changes when transactions modify its reserves. Reordering those changes can redistribute value.

## Begin with an AMM rather than a book

Uniswap-style automated market makers let traders exchange against liquidity pools instead of matching directly with another trader’s posted order. In a simple constant-product pool, reserve quantities `x` and `y` satisfy an invariant based on `x × y`. A swap changes their ratio, moving the marginal price; fees modify the accounting. [Uniswap protocol explanation](https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works)

Our own fictional pool starts with 100,000 quote units and 1,000 token units. Its fee is 0.3% per swap. A user spends 10,000 quote units. The lab calculates output as:

```text
effective input = input × (1 − fee)
token output    = token reserve × effective input
                  / (quote reserve + effective input)
```

The pool retains the full input, including the fee, and transfers the calculated token output. With these assumptions the standalone user receives about **90.661 tokens**. These are fictional units, not a token recommendation or live quote.

## Change the sequence

The comparison holds the user’s input and initial pool constant:

```text
Baseline:
  user buys

Surrounding sequence:
  another participant buys
  user tries to buy
  the other participant sells the tokens acquired earlier
```

In the second sequence, the preceding purchase changes reserves before the user reaches them. The user receives fewer tokens if their minimum-output condition still permits execution. The subsequent sale then happens against the changed pool.

The lab displays actual reserve calculations at each step. It does not infer profit merely from an up arrow: it subtracts the preceding purchase’s quote cost from the subsequent sale proceeds. That surplus includes the modeled pool fees but excludes gas, builder payments, financing, and inventory risk. It is not net profit.

The missing user output is also not automatically equal to the other participant’s surplus. Fees and changed terminal reserves affect the accounting. This is why comparing final balances is more informative than labeling every price change as theft.

## Minimum output and the rejected-trade branch

The lab derives the user’s minimum output from the baseline quote:

```text
minimum output = standalone output × (1 − tolerance)
```

If the changed pool would deliver less, that user swap reverts. Its input and output transfers are not applied to the pool. The separately modeled preceding and subsequent trades still execute; without the user’s intervening purchase, their round trip loses pool fees.

That branch is intentionally **not** an atomic three-transaction bundle. Different submission conditions could cause a whole bundle not to be included. A reverted transaction included on Ethereum may still pay gas; this lab omits gas, so a reverted user receiving zero output is not an assertion of zero economic cost. [Ethereum gas documentation](https://ethereum.org/developers/docs/gas/)

Try 5% tolerance, then 0.1%. The second setting rejects the default changed execution. A stricter minimum constrains execution; it does not guarantee inclusion, a favorable future price, or a free retry.

## Separate the mechanisms

| Mechanism | Source of opportunity | Distinction |
| --- | --- | --- |
| Arbitrage | Prices disagree across venues | Can align prices without deliberately worsening a preceding user’s execution |
| Backrunning | An earlier transaction creates a new state | Describes position after a transaction, not by itself a harmful action |
| Sandwiching | Trades surround a targeted swap | Can transfer value through worsened user execution |
| Liquidation | A lending position becomes eligible for protocol liquidation | Reward competition is different from a pool swap |
| Contract exploit | Authorization, accounting, or another invariant fails | A separate security mechanism; not every exploit is an ordering strategy |

The lab illustrates only the pool sequence; it does not implement an opportunity scanner, liquidation logic, contract exploit, or transaction sender.

## Who decides order?

Arrival time at an RPC endpoint is not an exchange-style promise of price-time priority. Flashbots documents private channels and bundles for expressing transaction inclusion conditions and preferred order to block-building infrastructure. Sending transactions earlier or paying more does not by itself establish guaranteed placement. [Flashbots architecture](https://docs.flashbots.net/flashbots-auction/overview)

Private submission can reduce exposure to public-mempool observation, but its information-sharing and trust assumptions matter. Flashbots Protect describes configurable privacy and builder-sharing behavior; privacy should be evaluated against the specific service rather than assumed from the word “private.” [Protect documentation](https://docs.flashbots.net/flashbots-protect/quick-start)

## The lesson across all three parts

Identify the authoritative sequence, the state each event reads, the rules for eligibility, and the balances after execution. Better network timing can influence outcomes, but the market mechanism determines what that timing is worth.

The lab is deterministic pool arithmetic. It has no chain, mempool, wallet, live victim transaction, reorganization model, transaction bidding, or fixed-point smart-contract arithmetic. Its usefulness is making the distribution of value and the rejected-execution branch visible.
