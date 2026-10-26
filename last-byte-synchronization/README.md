# Last-byte synchronization

Send most of several HTTP/1.1 requests ahead of time, then release their final body bytes in rapid succession. This narrows the time gap between complete requests arriving at a server, which is useful for studying concurrency and request timing on systems you control or are authorized to test.

**Timing does not choose a worker.** Load balancing, connection assignment, and the server's concurrency model determine which backend, process, thread, or coroutine handles a request. This tool cannot guarantee the same worker or simultaneous execution. The demo makes that visible by returning worker identities alongside server timestamps.

## Quick start

Requires **Python 3.10+** on macOS, Linux, or Windows. Uses only the Python standard library; no installation, packages, or credentials are needed for the local example.

From the repository root:

```bash
python3 last-byte-synchronization/demo.py
```

The demo starts a temporary HTTP server on a randomly assigned loopback port, stages eight POST requests, releases their tails, prints a JSON report, and shuts down. It does not contact an external service.

The server waits for each complete body before recording a monotonic timestamp. A sample run produced:

```json
{
  "connections": 8,
  "release_span_ns": 53833,
  "demo": {
    "server_complete_body_spread_ns": 338583,
    "server_processes": 1,
    "server_threads": 8
  }
}
```

That is about **54 microseconds** to perform the client releases and **339 microseconds** between the earliest and latest body-complete observations at the server. These are observations from one loopback run, not expected performance or a timing guarantee. The demo uses one process with a separate handler thread per connection; it does not simulate a load balancer. Run it repeatedly to see scheduler and transport variation.

## How it works

For a body containing `hello`, the client advertises `Content-Length: 5` and stages:

```text
POST /measure HTTP/1.1\r\n
Host: example.test\r\n
Content-Length: 5\r\n
Connection: close\r\n
Content-Type: application/octet-stream\r\n
\r\n
hell
```

The `\r\n` markers above represent real carriage-return/line-feed bytes. The final `o` is held back.

1. Open a separate TCP connection for each request, concurrently. For HTTPS, finish TLS handshakes with certificate and hostname verification enabled.
2. Enable `TCP_NODELAY` and send the full headers plus all but the last body byte on every connection.
3. Wait until all local prefix writes succeed, then pause for `--hold` seconds (default 0.1) to give the prefixes time to travel. This is not a server acknowledgment.
4. Send the last body byte on each socket from one tight loop. These sends are sequential and closely spaced, not atomic or literally simultaneous.
5. Collect responses concurrently, report timing and errors, and close every connection.

`Content-Length` counts bytes, including for UTF-8 text. The withheld byte can be the last byte of a multibyte character: the server ultimately receives the original complete byte sequence. Empty bodies are rejected because there is no body byte to withhold.

The endpoint must wait for the complete body before the operation you want to coordinate. Some servers route requests or start processing headers and streaming bodies earlier; withholding a byte does not delay all server activity.

## Use against your endpoint

The client sends the same request once on each connection. Choose an endpoint that accepts a nonempty body.

```bash
python3 last-byte-synchronization/last_byte.py \
  http://127.0.0.1:8000/measure \
  --connections 8 \
  --data '{"action":"example"}' \
  --header 'Content-Type: application/json' \
  --hold 0.1 \
  --timeout 5
```

For a binary payload or a larger existing body:

```bash
python3 last-byte-synchronization/last_byte.py \
  https://your-server.example/measure \
  --data-file payload.bin \
  --connections 4 \
  --response-limit 4096
```

HTTPS uses system/Python trusted certificate authorities and advertises HTTP/1.1 with ALPN. There is no insecure certificate bypass. For private certificates, configure Python's trust store, for example with `SSL_CERT_FILE`.

| Option | Default | Purpose |
| --- | --- | --- |
| `url` | Required | Absolute HTTP or HTTPS URL; path and query must be percent-encoded |
| `-n`, `--connections` | `8` | Number of requests, from 2 to 128 |
| `--data` | `x` | Request body encoded as UTF-8 |
| `--data-file` | None | Exact file bytes; mutually exclusive with `--data` |
| `-X`, `--method` | `POST` | HTTP method; endpoint must accept the body |
| `-H`, `--header` | None | Repeatable `Name: value` header |
| `--hold` | `0.1` | Seconds to pause after every prefix has been written |
| `--timeout` | `5.0` | Per-socket operation timeout, not a whole-batch deadline |
| `--response-limit` | `65536` | Maximum response body bytes retained per request |

The client manages `Host`, `Content-Length`, and `Connection`. It rejects overrides and unsupported framing headers such as `Transfer-Encoding` and `Expect`, as well as control characters in header values. It defaults to `application/octet-stream` unless a content type is supplied. It connects directly, does not use proxy environment variables, and does not follow redirects, retry requests, or manage cookies automatically. Each invocation is one batch; inspect HTTP statuses yourself to decide whether the application operation succeeded.

## Read the output

Output is JSON. Redirect it to a file to compare runs:

```bash
python3 last-byte-synchronization/demo.py > timing.json
```

- `prepared_ns`: elapsed time until every connection's prefix write succeeded.
- `release_span_ns`: time from just before the first final-byte send until just after the last final-byte send. Includes local scheduling and socket-write time.
- `results`: one entry per connection, numbered from zero. Includes release start/end offsets, HTTP status, a UTF-8 response body preview, truncation flag, and response collection finish offset or an error.
- `demo.server_complete_body_spread_ns`: latest minus earliest server body-complete timestamp, available only in the instrumented demo.

Client offsets use `time.perf_counter_ns()` relative to batch start. Server timestamps are generated separately; compare server timestamps with each other, not with client offsets. Nanosecond units do not imply nanosecond accuracy. Response bodies are limited in bytes before decoding; binary responses are displayed with replacement characters. Reading one extra byte detects truncation, after which the connection is closed.

Exit status is 0 when all responses were collected, including HTTP error statuses; 1 for preparation failures or per-request transport/protocol errors. Invalid command syntax exits with argparse's status 2. A preparation failure aborts the batch before any withheld byte is sent and closes prepared sockets. Servers may still have acted on the partial requests. Once release starts, a failed send or read cannot undo any request already sent; inspect the per-connection errors before repeating a batch.

## Limitations and troubleshooting

- **Server completes requests before release:** its relevant logic may execute before reading the whole body. Instrument the operation you care about, or use a body-consuming test endpoint.
- **Timeouts or resets:** the server/proxy may reject the endpoint or method, limit concurrent connections, or impose an incomplete-body deadline. Keep the hold short relative to those deadlines. Early connections also wait for the slowest preparation.
- **Client spread is small but server spread is large:** packet scheduling, independent TCP connections, TLS records, proxy buffering, and server scheduling can all add skew. Measure at the server and repeat trials.
- **More connections worsen timing:** the release loop takes longer as the batch grows, and socket backpressure can delay later releases. Start with a small batch.
- **Same-worker behavior is required:** configure routing or connection affinity separately and log worker identity. Timing alone provides no affinity mechanism, and a synchronous worker may serialize the requests.
- **HTTP/2 single-packet synchronization:** not implemented. This tool uses separate HTTP/1.1 connections, so their tails cannot share a TCP packet. HTTP/2 requires a different framing and multiplexing implementation.

This implementation uses `socket` for controlled writes, `ssl` for verified TLS, `ThreadPoolExecutor` for setup and response collection, `http.client` for response parsing, and `http.server` for the local demonstration. It buffers the supplied request body in memory and is intended for small, controlled experiments.

## Files and development

| File | Purpose |
| --- | --- |
| `last_byte.py` | Reusable request builder, synchronization function, and CLI |
| `demo.py` | Instrumented local HTTP server and complete runnable example |
| `test_last_byte.py` | Protocol behavior, input validation, cleanup, and response limit tests |
| [PROTOCOL.md](PROTOCOL.md) | Primary sources and deeper transport/framing explanations |

Run the tests from the repository root:

```bash
python3 -m unittest discover -s last-byte-synchronization -v
```

The tests exercise real loopback HTTP requests, verify that completion waits for the last byte, and simulate setup failure to verify that no tail is released and prepared sockets close. They do not assert a timing threshold: scheduler-dependent timing is measured by the demo. Automated tests cover plain HTTP; verified HTTPS is implemented but has not been exercised against an external endpoint here.
