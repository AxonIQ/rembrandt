#!/usr/bin/env python3
"""Delivery checks, without touching Google.

    python3 kit/export/test_delivery.py

Google is not reachable from the sandbox and will not be until the allowlist lands, so the way to
know this path works is to stand a fake Google and a fake token store in front of it and assert on
what Rembrandt does. Each case drives gdrive.js through a stubbed fetch and checks the outcome the
runner would see.

The cases are the ones that will actually happen: a person who has never authorised, a person whose
authorisation was revoked, a normal upload, a first upload that has to create the folder, a deck
Google refuses, and a service that is not on the allowlist yet.
"""
import json, subprocess, sys, tempfile, os, pathlib

HERE = pathlib.Path(__file__).resolve().parent

HARNESS = r"""
const path = require('path'), fs = require('fs');
const CASE = JSON.parse(process.env.CASE);

// The service host and client are injected, so this never reads the shipped service.json.
process.env.REMBRANDT_SERVICE_URL = 'https://service.test';
process.env.REMBRANDT_GOOGLE_CLIENT_ID = 'cid';
process.env.REMBRANDT_GOOGLE_CLIENT_SECRET = 'csec';

const calls = [];
const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => headers[k.toLowerCase()] || null },
  json: async () => body, text: async () => JSON.stringify(body),
});

global.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push({ url: u, method: opts.method || 'GET' });

  if (u.startsWith('https://service.test/api/token')) {
    if ((opts.method || 'GET') === 'GET') {
      if (CASE.stored === null) return reply(404, { error: 'no token stored for that address' });
      if (CASE.serviceDown) throw Object.assign(new Error('fetch failed'), { name: 'TypeError' });
      return reply(200, { refresh_token: CASE.stored });
    }
    return reply(200, { ok: true });
  }

  if (u === 'https://oauth2.googleapis.com/token') {
    const body = String(opts.body);
    if (body.includes('grant_type=authorization_code')) {
      return CASE.codeBad ? reply(400, { error: 'invalid_grant', error_description: 'bad code' })
                          : reply(200, { refresh_token: 'refresh-abc' });
    }
    return CASE.revoked ? reply(400, { error: 'invalid_grant' }) : reply(200, { access_token: 'access-xyz' });
  }

  if (u.startsWith('https://www.googleapis.com/drive/v3/files?q=')) {
    return reply(200, { files: CASE.folderExists ? [{ id: 'folder-1' }] : [] });
  }
  if (u.startsWith('https://www.googleapis.com/drive/v3/files?fields=id')) {
    return reply(200, { id: 'folder-new' });
  }
  if (u.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
    if (CASE.uploadRefused) return reply(403, { error: { message: 'quota' } });
    return reply(200, {}, { location: 'https://upload.test/session/1' });
  }
  if (u === 'https://upload.test/session/1') {
    return reply(200, { id: 'deck-9', webViewLink: 'https://docs.google.com/presentation/d/deck-9/edit' });
  }
  throw new Error('unstubbed call: ' + u);
};

const g = require(path.join(process.env.KIT, 'gdrive.js'));

(async () => {
  const out = { ready: g.ready() };
  if (CASE.exchange) {
    out.exchange = await g.exchange('the-code', 'a@axoniq.io');
  } else {
    const auth = await g.accessToken('a@axoniq.io');
    out.auth = auth;
    if (auth.token) {
      const tmp = path.join(require('os').tmpdir(), 'fake.pptx');
      fs.writeFileSync(tmp, Buffer.alloc(2048, 7));
      out.upload = await g.upload(tmp, 'A deck', auth.token);
    }
  }
  out.calls = calls.map((c) => c.method + ' ' + c.url.split('?')[0]);
  console.log(JSON.stringify(out));
})();
"""


def run(case):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(HARNESS)
        script = f.name
    env = {**os.environ, 'CASE': json.dumps(case), 'KIT': str(HERE)}
    r = subprocess.run([sys.executable and 'node', script], capture_output=True, text=True, env=env)
    os.unlink(script)
    if r.returncode != 0:
        raise SystemExit('harness failed:\n' + r.stdout + r.stderr)
    return json.loads(r.stdout.strip().splitlines()[-1])


CASES = []


def case(name):
    def wrap(fn):
        CASES.append((name, fn))
        return fn
    return wrap


@case('a person who has never authorised is told so, and nothing is uploaded')
def _():
    out = run({'stored': None})
    assert 'not authorised yet' in out['auth']['error'], out
    assert not any('upload' in c for c in out['calls']), out['calls']


@case('a revoked authorisation is reported as such, not as a transient failure')
def _():
    out = run({'stored': 'refresh-abc', 'revoked': True})
    assert 'no longer valid' in out['auth']['error'], out


@case('a normal run uploads and returns the Slides link')
def _():
    out = run({'stored': 'refresh-abc', 'folderExists': True})
    assert out['upload']['url'].endswith('/deck-9/edit'), out
    assert out['upload']['folder'] is True, out
    assert 'POST https://www.googleapis.com/upload/drive/v3/files' in out['calls'], out['calls']
    assert 'PUT https://upload.test/session/1' in out['calls'], out['calls']


@case('the first run creates the folder instead of dropping the deck in the root')
def _():
    out = run({'stored': 'refresh-abc', 'folderExists': False})
    assert 'POST https://www.googleapis.com/drive/v3/files' in out['calls'], out['calls']
    assert out['upload']['folder'] is True, out


@case('a deck Google refuses is an error, never a link')
def _():
    out = run({'stored': 'refresh-abc', 'folderExists': True, 'uploadRefused': True})
    assert 'error' in out['upload'] and 'url' not in out['upload'], out
    # and it says Google refused it, rather than blaming something downstream of the refusal
    assert '403' in out['upload']['error'], out
    assert 'PUT https://upload.test/session/1' not in out['calls'], out['calls']


@case('a service that cannot be reached does not look like a missing authorisation')
def _():
    out = run({'stored': 'refresh-abc', 'serviceDown': True})
    assert 'not authorised yet' not in out['auth']['error'], out


@case('the one-time code exchange stores the refresh token')
def _():
    out = run({'stored': None, 'exchange': True})
    assert out['exchange'].get('ok') is True, out
    assert 'POST https://service.test/api/token' in out['calls'], out['calls']


@case('a bad or expired code fails loudly and stores nothing')
def _():
    out = run({'stored': None, 'exchange': True, 'codeBad': True})
    assert 'error' in out['exchange'], out
    assert 'POST https://service.test/api/token' not in out['calls'], out['calls']


if __name__ == '__main__':
    bad = 0
    for name, fn in CASES:
        try:
            fn()
            print(f'  ok   {name}')
        except AssertionError as e:
            bad += 1
            print(f'  FAIL {name}\n       {e}')
    print(f'delivery: {"PASS" if not bad else "FAIL"} ({len(CASES) - bad}/{len(CASES)})')
    sys.exit(1 if bad else 0)
