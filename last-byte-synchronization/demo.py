#!/usr/bin/env python3
"""Run the synchronization client against an instrumented loopback server."""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import threading
import time

from last_byte import build_request, synchronize


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = self.rfile.read(length)
        if len(body) != length:
            return
        # Timestamp immediately after reading the complete body, before formatting.
        complete_ns = time.perf_counter_ns()
        payload = json.dumps({'complete_ns': complete_ns,
                              'body_bytes': len(body),
                              'process_id': os.getpid(),
                              'thread_id': threading.get_ident()}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_):
        pass


@contextmanager
def local_server(handler=Handler):
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/measure'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def main():
    with local_server() as url:
        report = synchronize(build_request(url, b'demo-payload'), connections=8)
    if any('error' in result for result in report['results']):
        print(json.dumps(report, indent=2))
        return 1
    observations = [json.loads(result['body']) for result in report['results']]
    times = [observation['complete_ns'] for observation in observations]
    report['demo'] = {
        'server_complete_body_spread_ns': max(times) - min(times),
        'server_processes': len({o['process_id'] for o in observations}),
        'server_threads': len({o['thread_id'] for o in observations}),
        'note': 'This demo uses one process with a separate handler thread per connection.',
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
