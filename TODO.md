# Tool ideas

Potential additions to the collection, not implemented features. Each candidate should become its own subfolder with a detailed README, a runnable local experiment, and a website explanation. Suggested folder names below are placeholders.

Start with **worker affinity**, **coordinated omission**, and **deterministic race replay**: they answer a concrete question, expose surprising behavior, and fit small local demos.

## 1. Worker affinity and connection reuse

- [ ] Build `worker-affinity/`.
- **Question:** What actually determines whether two requests reach the same worker?
- **Technique:** Compare a persistent connection, fresh connections, and synchronized fresh connections against a local reverse proxy with explicit routing policies.
- **First implementation:** Two backend processes return their process ID and request timestamps. A proxy supports round-robin and a deliberately sticky routing policy. Send the same workload under each configuration.
- **Measure:** Backend identity distribution, same-backend rate for request pairs, connection reuse, and operation overlap.
- **Interesting result:** Separate timing from routing. Show why the existing last-byte tool cannot establish worker affinity by itself. Identify proxy affinity and backend assignment independently.
- **Scope:** Medium; Python client, proxy, and backend fixtures.

## 2. Coordinated omission: the benchmark that hides a stall

- [ ] Build `coordinated-omission/`.
- **Question:** Why can a benchmark look healthier precisely when the server becomes slower?
- **Technique:** Compare a client that waits for each response before sending more work with a client that schedules arrivals independently of responses. Record intended send time as well as actual send time.
- **First implementation:** A local server periodically pauses processing. Run both workload models at a defined target rate and export request timelines and latency percentiles.
- **Measure:** Scheduled-to-complete and actual-send-to-complete latency, missed schedules, achieved throughput, and failures. Bound outstanding requests and report dropped work explicitly.
- **Interesting result:** Visualize the missing samples during stalls instead of presenting a misleadingly reassuring average.
- **Scope:** Medium; Python scheduling and a static report. Reference: [wrk2’s measurement explanation](https://github.com/giltene/wrk2#readme).

## 3. Deterministic race replay

- [ ] Build `race-replay/`.
- **Question:** Can we reproduce a concurrency bug without relying on lucky timing?
- **Technique:** Put named synchronization gates around a shared-state operation, then prescribe the interleaving of two requests.
- **First implementation:** Two requests read a toy counter before either writes it. Reproduce a lost update, then run the same scenario with an atomic update or transaction.
- **Measure:** Event order, initial/final state, and whether the invariant holds. Save the schedule for replay.
- **Interesting result:** Last-byte synchronization makes arrivals close; controlled server gates make the relevant execution order reproducible.
- **Scope:** Small; Python with a local state store. Explicitly distinguish the deliberately instrumented fixture from arbitrary external servers.

## 4. Retry storms and jitter

- [ ] Build `retry-jitter/`.
- **Question:** When does retrying help recovery, and when does it prolong overload?
- **Technique:** Compare immediate retries, capped exponential backoff, and randomized backoff using identical initial workloads and seeded randomness.
- **First implementation:** A capacity-limited local service fails briefly, then recovers. Run a fixed population of clients under each retry policy.
- **Measure:** Attempts per successful operation, peak arrival rate, recovery time, and latency; enforce a common retry budget.
- **Interesting result:** Plot retry waves and see whether jitter spreads the bursts. Reference: [Amazon’s timeouts, retries, and backoff with jitter](https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf).
- **Scope:** Small to medium; Python and a timeline visualization.

## 5. Hedged requests and tail latency

- [ ] Build `hedged-requests/`.
- **Question:** How much extra work is worth spending to reduce slow responses?
- **Technique:** Send a second copy of a read-only request to another replica after a configurable delay if the first is still pending; accept the first successful result.
- **First implementation:** Two local replicas with seeded occasional delays. Sweep the hedge delay and compare with a single-request baseline.
- **Measure:** p50/p95/p99 latency, extra requests, backend work completed, and cancellation success. Model shared bottlenecks as a separate case.
- **Interesting result:** Expose the latency/work tradeoff and show that canceling the client’s wait does not necessarily stop server execution.
- **Scope:** Medium; asynchronous Python and read-only fixtures.

## 6. Tiny writes, TCP_NODELAY, and buffering

- [ ] Build `tiny-writes/`.
- **Question:** How do application write boundaries relate to server reads and network packets?
- **Technique:** Compare tiny writes and batched writes with TCP_NODELAY enabled and disabled. Add a controlled RTT variant later.
- **First implementation:** A TCP echo fixture timestamps every read; a client sends identical bytes using different write sizes. Optionally collect a packet capture.
- **Measure:** Completion latency, write/read sizes, and packetization when captured. Do not treat a server read as a packet boundary or promise a fixed delay.
- **Interesting result:** Explain why one `send()` is not necessarily one packet, directly complementing last-byte synchronization.
- **Scope:** Small initially; network emulation and capture are optional platform-specific extensions.

## 7. Idempotency under ambiguous failure

- [ ] Build `idempotency-replay/`.
- **Question:** What happens when an operation succeeds but its response disappears?
- **Technique:** Commit a toy ledger operation, deliberately drop its response, then retry with and without an idempotency key.
- **First implementation:** A SQLite-backed API records the key, payload fingerprint, result, and operation atomically. Add simultaneous duplicate requests and restart recovery.
- **Measure:** Client attempts versus committed operations; verify same-key/different-payload rejection.
- **Interesting result:** Demonstrate duplicate prevention at the commit boundary, rather than assuming a timeout means nothing happened.
- **Scope:** Medium; Python and SQLite. Related context: [Amazon’s retry guidance](https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf).

## 8. Cache stampedes and request coalescing

- [ ] Build `cache-stampede/`.
- **Question:** How many backend computations does one expired cache entry trigger?
- **Technique:** Compare naive cache misses with a per-key shared in-flight computation and optional stale-while-refresh behavior.
- **First implementation:** Synchronize callers at an expired key backed by an intentionally slow computation. Include leader failure and waiter cancellation.
- **Measure:** Backend executions per key, waiter latency, stale-response count, and cleanup after errors.
- **Interesting result:** Make the burst visible, then show whether coalescing reduces duplicate work without accidentally serializing unrelated keys.
- **Scope:** Small to medium; asyncio fixture and a timeline.

## 9. Backpressure and queue collapse

- [ ] Build `backpressure/`.
- **Question:** Why can accepting more work make almost everyone slower?
- **Technique:** Compare an unbounded queue, a bounded queue with rejection, and a concurrency limit under a burst.
- **First implementation:** Producers feed a deliberately slow worker pool; vary arrival rate and queue capacity. Give every operation a deadline.
- **Measure:** Queue depth, queue-wait versus service time, completed/rejected/expired work, and drain time after the burst.
- **Interesting result:** Show where latency accumulates and whether expired work continues consuming capacity.
- **Scope:** Small; deterministic simulation first, real local HTTP fixture second.

## 10. HTTP/2 multiplexing and completion synchronization

- [ ] Build `http2-synchronization/`.
- **Question:** What changes when many requests share one framed connection?
- **Technique:** Stage request bodies on multiple HTTP/2 streams and release their completion frames together. Compare with separate HTTP/1.1 connections.
- **First implementation:** A local HTTP/2 server and a protocol-aware client log stream IDs, frame releases, and body-complete timestamps. Respect flow-control windows and negotiated stream limits.
- **Measure:** Client release spread, server completion spread, and execution overlap over repeated trials.
- **Interesting result:** Explore HTTP/2 framing and stream concurrency. A single socket write alone does not prove a single TCP packet; verify any single-packet claim with capture.
- **Scope:** Large; start with an HTTP/2 library rather than implementing HPACK and framing from scratch. Reference: [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html).

## Common implementation bar

For each selected idea:

- Ship a local fixture and one command that reproduces the central behavior.
- Include a baseline, the proposed technique, and explicit measurements.
- Label synthetic illustrations separately from observed timings.
- Export machine-readable results and explain the limits of the experiment.
- Document prerequisites, usage, failure cases, and interpretation in the tool’s README; add the concept to `website/`.
