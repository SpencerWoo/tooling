#!/usr/bin/env python3
"""Synchronize the final body byte of independent HTTP/1.1 requests."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import http.client
import json
from pathlib import Path
import re
import socket
import ssl
import time
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Request:
    host: str
    port: int
    tls: bool
    wire: bytes
    method: str


def build_request(url: str, body: bytes = b'x', method: str = 'POST',
                  headers: tuple[str, ...] = ()) -> Request:
    """Build an unambiguous Content-Length request, including its withheld byte."""
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('URL must use http:// or https:// and include a host')
    if parsed.username is not None or parsed.password is not None or parsed.fragment:
        raise ValueError('URL credentials and fragments are unsupported')
    if not body:
        raise ValueError('body must contain at least one byte to withhold')
    token = r"[!#$%&'*+.^_`|~0-9A-Za-z-]+"
    if not re.fullmatch(token, method):
        raise ValueError('invalid HTTP method')
    port = parsed.port if parsed.port is not None else (443 if parsed.scheme == 'https' else 80)
    if port == 0:
        raise ValueError('URL port must be between 1 and 65535')
    hostname = parsed.hostname.encode('idna').decode('ascii')
    authority = f'[{hostname}]' if ':' in hostname else hostname
    if parsed.port is not None:
        authority += f':{port}'
    target = parsed.path or '/'
    if parsed.query:
        target += '?' + parsed.query
    if any(ord(c) <= 32 or ord(c) >= 127 for c in target):
        raise ValueError('URL path and query must be ASCII and percent-encoded')
    lines = [f'{method} {target} HTTP/1.1', f'Host: {authority}',
             f'Content-Length: {len(body)}', 'Connection: close']
    supplied_type = False
    reserved = {'host', 'content-length', 'transfer-encoding', 'connection',
                'expect', 'upgrade', 'trailer'}
    for header in headers:
        name, separator, value = header.partition(':')
        if not separator or not re.fullmatch(token, name):
            raise ValueError('headers must have the form Name: value')
        if any(ord(c) < 32 and c != '\t' or ord(c) == 127 for c in value):
            raise ValueError('header values cannot contain control characters')
        if name.lower() in reserved:
            raise ValueError(f'{name} is managed by the tool or unsupported')
        supplied_type |= name.lower() == 'content-type'
        lines.append(f'{name}:{value}')
    if not supplied_type:
        lines.append('Content-Type: application/octet-stream')
    try:
        wire = ('\r\n'.join(lines) + '\r\n\r\n').encode('latin-1') + body
    except UnicodeEncodeError as exc:
        raise ValueError('HTTP headers must be Latin-1 encodable') from exc
    return Request(hostname, port, parsed.scheme == 'https', wire, method)


def synchronize(request: Request, connections: int = 8, hold: float = 0.1,
                timeout: float = 5.0, response_limit: int = 65536) -> dict:
    """Prepare every connection, then release tails from one tight send loop.

    Setup failures abort the entire batch before any final byte is released.
    Once release begins, errors cannot undo requests already sent.
    """
    import math
    if not 2 <= connections <= 128:
        raise ValueError('connections must be between 2 and 128')
    if not math.isfinite(hold) or hold < 0 or not math.isfinite(timeout) or timeout <= 0:
        raise ValueError('hold must be finite and nonnegative; timeout must be finite and positive')
    if response_limit < 1:
        raise ValueError('response_limit must be positive')
    context = ssl.create_default_context() if request.tls else None
    if context:
        context.set_alpn_protocols(['http/1.1'])
    sockets: list[socket.socket] = []
    started = time.perf_counter_ns()

    def prepare(index: int):
        sock = socket.create_connection((request.host, request.port), timeout=timeout)
        try:
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            if context:
                sock = context.wrap_socket(sock, server_hostname=request.host)
            sock.sendall(request.wire[:-1])
            return index, sock
        except BaseException:
            sock.close()
            raise

    def receive(index: int, sock: socket.socket, result: dict):
        try:
            response = http.client.HTTPResponse(sock, method=request.method)
            try:
                response.begin()
                payload = response.read(response_limit + 1)
                result.update(status=response.status,
                              body=payload[:response_limit].decode('utf-8', errors='replace'),
                              body_truncated=len(payload) > response_limit)
            finally:
                response.close()
        except Exception as exc:
            result['error'] = f'{type(exc).__name__}: {exc}'
        result['finished_ns'] = time.perf_counter_ns() - started
        return result

    try:
        prepared = {}
        errors = []
        with ThreadPoolExecutor(max_workers=connections) as pool:
            futures = [pool.submit(prepare, i) for i in range(connections)]
            for future in as_completed(futures):
                try:
                    index, sock = future.result()
                    sockets.append(sock)
                    prepared[index] = sock
                except Exception as exc:
                    errors.append(f'{type(exc).__name__}: {exc}')
        if errors:
            raise RuntimeError('Preparation failed; no final bytes released: ' + '; '.join(errors))
        prepared_ns = time.perf_counter_ns() - started
        time.sleep(hold)
        results = []
        # No response reads or thread scheduling between final-byte writes.
        for index in range(connections):
            result = {'connection': index, 'release_started_ns': time.perf_counter_ns() - started}
            try:
                prepared[index].sendall(request.wire[-1:])
            except Exception as exc:
                result['error'] = f'{type(exc).__name__}: {exc}'
            result['release_finished_ns'] = time.perf_counter_ns() - started
            results.append(result)
        with ThreadPoolExecutor(max_workers=connections) as pool:
            futures = [pool.submit(receive, i, prepared[i], result)
                       for i, result in enumerate(results) if 'error' not in result]
            for future in futures:
                future.result()
        return {
            'connections': connections,
            'prepared_ns': prepared_ns,
            'hold_seconds': hold,
            'release_span_ns': results[-1]['release_finished_ns'] - results[0]['release_started_ns'],
            'results': results,
        }
    finally:
        for sock in sockets:
            sock.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', help='HTTP(S) endpoint that consumes a request body')
    parser.add_argument('-n', '--connections', type=int, default=8)
    parser.add_argument('--hold', type=float, default=0.1, help='seconds after all prefixes are sent')
    parser.add_argument('--timeout', type=float, default=5.0, help='per-socket operation timeout in seconds')
    parser.add_argument('-X', '--method', default='POST')
    parser.add_argument('-H', '--header', action='append', default=[])
    data = parser.add_mutually_exclusive_group()
    data.add_argument('--data', help='UTF-8 body; default: x')
    data.add_argument('--data-file', type=Path, help='read a binary body from a file')
    parser.add_argument('--response-limit', type=int, default=65536, help='maximum response body bytes retained per request')
    args = parser.parse_args()
    try:
        body = args.data_file.read_bytes() if args.data_file else (args.data if args.data is not None else 'x').encode()
        request = build_request(args.url, body, args.method, tuple(args.header))
        report = synchronize(request, args.connections, args.hold, args.timeout, args.response_limit)
    except (ValueError, OSError, RuntimeError) as exc:
        parser.exit(1, f'error: {exc}\n')
    print(json.dumps(report, indent=2))
    return int(any('error' in result for result in report['results']))


if __name__ == '__main__':
    raise SystemExit(main())
