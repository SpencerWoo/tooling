import json
import socket
import threading
import unittest
from unittest.mock import patch

from demo import Handler, local_server
from last_byte import build_request, synchronize


class SynchronizationTests(unittest.TestCase):
    def test_server_waits_for_last_byte(self):
        received = threading.Event()

        class Observed(Handler):
            def do_POST(self):
                super().do_POST()
                received.set()

        with local_server(Observed) as url:
            request = build_request(url, b'hello')
            with socket.create_connection((request.host, request.port), timeout=2) as sock:
                sock.sendall(request.wire[:-1])
                self.assertFalse(received.wait(0.15), 'server completed before final byte')
                sock.sendall(request.wire[-1:])
                self.assertTrue(received.wait(2), 'server never completed after release')
                self.assertIn(b'200 OK', sock.recv(4096))

    def test_batch_completes_with_binary_body_and_query(self):
        with local_server() as url:
            report = synchronize(build_request(url + '?a=1', b'\x00\xff\n'), connections=4, hold=0)
        self.assertEqual(len(report['results']), 4)
        for result in report['results']:
            self.assertNotIn('error', result)
            self.assertEqual(result['status'], 200)
            self.assertEqual(json.loads(result['body'])['body_bytes'], 3)
        self.assertGreaterEqual(report['release_span_ns'], 0)

    def test_failed_preparation_aborts_and_closes_ready_sockets(self):
        class FakeSocket:
            def __init__(self):
                self.sent = []
                self.closed = False

            def setsockopt(self, *_):
                pass

            def sendall(self, data):
                self.sent.append(data)

            def close(self):
                self.closed = True

        sock = FakeSocket()
        request = build_request('http://localhost/', b'hello')
        with patch('last_byte.socket.create_connection', side_effect=[sock, OSError('setup failed')]):
            with self.assertRaisesRegex(RuntimeError, 'no final bytes released'):
                synchronize(request, connections=2)
        self.assertEqual(sock.sent, [request.wire[:-1]])
        self.assertTrue(sock.closed)

    def test_response_limit(self):
        with local_server() as url:
            report = synchronize(build_request(url), connections=2, hold=0, response_limit=4)
        for result in report['results']:
            self.assertTrue(result['body_truncated'])
            self.assertEqual(len(result['body']), 4)

    def test_invalid_framing_and_inputs(self):
        for header in ('Content-Length: 1', 'Transfer-Encoding: chunked', 'Expect: 100-continue', 'X: a\r\nb'):
            with self.subTest(header=header), self.assertRaises(ValueError):
                build_request('http://localhost/', headers=(header,))
        for url in ('ftp://localhost/', 'http://a:b@localhost/', 'http://localhost/a b'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                build_request(url)
        with self.assertRaises(ValueError):
            build_request('http://localhost/', b'')
        for hold in (float('nan'), float('inf'), -1):
            with self.subTest(hold=hold), self.assertRaises(ValueError):
                synchronize(build_request('http://localhost/'), hold=hold)


if __name__ == '__main__':
    unittest.main()
