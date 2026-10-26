# Protocol notes and sources

Last-byte synchronization reduces the gap between HTTP/1.1 request completions: open a separate connection for each request, send headers and all but the final body byte, then release the withheld bytes together. PortSwigger distinguishes this HTTP/1 technique from its HTTP/2 single-packet technique. Neither a small client-side send spread nor a successful response proves simultaneous application execution. [PortSwigger race-condition guide](https://portswigger.net/web-security/race-conditions)

## What is withheld

For a nonempty body of `N` **bytes**, advertise `Content-Length: N`, send the complete header section and `body[:-1]`, and retain `body[-1:]`. The length counts encoded octets, not Unicode characters. An HTTP/1.1 request with fewer than its declared bytes is incomplete; a timeout or disconnect before completion leaves an incomplete message. Do not combine `Content-Length` with `Transfer-Encoding`. [RFC 9112, sections 6.2–6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)

Inference from these framing rules: withholding the final body byte delays **message completion**, but does not force every server to postpone all processing. A server can parse headers, route the request, invoke a handler, or consume a streaming body before completion. The strategy is useful when the operation being measured waits for the full body.

## Transport choices

- Python's standard-library `socket` API gives direct control over the split; `sendall()` sends until the supplied bytes are accepted or an error occurs. Its completion is not a server acknowledgment. Socket behavior also depends on the operating system. [Python socket documentation](https://docs.python.org/3/library/socket.html#socket.socket.sendall)
- `TCP_NODELAY` disables Nagle's small-write aggregation, reducing one source of delay for the final byte. It cannot guarantee a packet boundary, immediate delivery, or synchronized remote execution. TCP also remains subject to congestion control. [Linux TCP socket options](https://www.man7.org/linux/man-pages/man7/tcp.7.html), [RFC 9293, section 3.7.4](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.7.4)
- HTTPS uses a TLS socket. Complete each handshake before staging requests; use certificate and hostname verification and advertise only `http/1.1` with ALPN. The final application byte becomes encrypted TLS data, rather than a literal one-byte network packet. [Python SSL documentation](https://docs.python.org/3/library/ssl.html#ssl.create_default_context), [ALPN configuration](https://docs.python.org/3/library/ssl.html#ssl.SSLContext.set_alpn_protocols)
- A proxy can change the point at which synchronization takes effect. For example, NGINX request buffering reads the entire client body before forwarding it; disabling buffering forwards arriving body data immediately. Thus staging at a front end does not prove staging at an application worker. [NGINX request buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering)

## What timing can establish

Record local release/send times with a monotonic clock, but label them as client observations. Scheduler delays, socket backpressure, packet loss, different TCP connections, TLS processing, proxy behavior, and application scheduling can widen the remote gap. A staging pause allows time for prefixes to travel; it does not acknowledge their arrival. Instrument the server's body-complete or operation-start timestamp to measure the relevant remote spread. PortSwigger's own benchmark found a wider execution spread for last-byte synchronization than for its HTTP/2 method. [PortSwigger original research](https://portswigger.net/research/smashing-the-state-machine)

**Same-worker delivery is not guaranteed.** This is an inference from the scope of the mechanism: controlling when requests complete does not select a load balancer backend, process, thread, or coroutine. In a single-threaded synchronous worker, requests may actually execute sequentially. For a controlled experiment, log worker identity alongside the server timestamps.

## Difference from the HTTP/2 single-packet technique

HTTP/1.1 synchronization here uses independent connections, so the final fragments cannot share one TCP segment across those connections. PortSwigger's HTTP/2 technique multiplexes requests over a single connection and groups completion fragments into one packet to avoid between-packet network jitter. That is a separate implementation; its guarantees and measured improvements should not be attributed to this tool. [PortSwigger single-packet research](https://portswigger.net/research/the-single-packet-attack-making-remote-race-conditions-local)

Sources checked: 2026-10-26.
