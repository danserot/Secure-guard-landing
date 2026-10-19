// Isolated loopback-only nginx integration check. Never targets a deployed site.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, realpath, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createInterface } from 'node:readline';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2).filter(value => value !== '--inspect');
assert.ok(args[0], 'Pass an explicit path to the official nginx executable');
assert.ok(!process.argv.includes('--inspect') || process.stdin.isTTY, '--inspect requires an interactive terminal (TTY)');
const executable = resolve(args[0]);
const mimeTypes = resolve(args[1] || join(executable, '..', 'conf', 'mime.types'));
const temporary = await mkdtemp(join(tmpdir(), 'secureguard-nginx-'));
const prefix = temporary.replaceAll('\\', '/') + '/';
const checks = [];
let nginx;
const backend = createServer((req, res) => {
  req.resume();
  res.writeHead(req.url.startsWith('/api/auth/login') ? 401 : 200, { 'Content-Type': 'application/json', 'X-Powered-By': 'test-upstream' });
  res.end(JSON.stringify({ forwardedFor: req.headers['x-forwarded-for'] }));
});
function verify(condition, message) { assert.ok(condition, message); checks.push(message); }
function command(args) {
  const result = spawnSync(executable, ['-p', prefix, '-c', 'nginx.conf', ...args], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr || 'nginx failed');
  return result;
}

try {
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  await mkdir(join(temporary, 'logs'));
  await mkdir(join(temporary, 'temp'));
  await cp(join(root, 'frontend', 'dist'), join(temporary, 'html'), { recursive: true });
  let site = await readFile(join(root, 'frontend', 'nginx.conf'), 'utf8');
  site = site.replace('listen 80;', `listen 127.0.0.1:${port};`)
    .replace('/usr/share/nginx/html', `${prefix}html`)
    .replace('http://backend:8000', `http://127.0.0.1:${backend.address().port}`);
  await writeFile(join(temporary, 'nginx.conf'), `worker_processes 1;\npid logs/nginx.pid;\nevents { worker_connections 1024; }\nhttp { include "${mimeTypes.replaceAll('\\', '/')}";\n${site}\n}\n`);
  command(['-t']);
  nginx = spawn(executable, ['-p', prefix, '-c', 'nginx.conf', '-g', 'daemon off;'], { windowsHide: true, stdio: 'ignore' });
  nginx.on('error', () => {});
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/healthz')).ok) break; } catch { /* startup */ }
    if (attempt === 99) throw new Error('nginx did not become ready');
    await delay(50);
  }
  async function request(path, init) {
    const response = await fetch(base + path, init);
    return { status: response.status, headers: response.headers, body: await response.text() };
  }
  const landing = await request('/landing?security-check=1');
  verify(landing.status === 200, 'Landing and query-string SPA fallback serve successfully');
  verify(landing.headers.get('content-security-policy')?.includes("script-src 'self'"), 'Landing CSP survives the internal index.html rewrite');
  verify(landing.headers.get('content-security-policy')?.includes('https://script.googleusercontent.com'), 'CSP allows the configured Google intake redirect');
  verify(landing.headers.get('x-content-type-options') === 'nosniff' && landing.headers.get('x-frame-options') === 'DENY', 'Security headers are present');
  verify(!/nginx\//i.test(landing.headers.get('server')), 'Server version is hidden');
  const dashboard = await request('/incidents');
  verify(dashboard.status === 200 && !dashboard.headers.has('content-security-policy'), 'Existing dashboard SPA route is preserved');
  for (const path of ['/.env', '/.git/config', '/%2eenv', '/backup.sql', '/missing.js']) {
    const result = await request(path);
    verify(result.status === 404, `${path} cannot return a secret or SPA success fallback`);
    verify(result.headers.get('x-content-type-options') === 'nosniff', 'Security headers also cover error responses');
  }
  verify((await request('/landing', { method: 'POST', body: '{}' })).status === 405, 'Static page rejects POST');
  verify((await request('/api/auth/login')).status === 405, 'Login accepts only POST');
  verify((await request('/api/auth/login', { method: 'POST', body: 'x'.repeat(17000) })).status === 413, 'Login rejects oversized request bodies');
  const upstream = await request('/api/runtime', { headers: { 'X-Forwarded-For': '198.51.100.23' } });
  verify(JSON.parse(upstream.body).forwardedFor === '127.0.0.1', 'Spoofed forwarded IP cannot reach the upstream as a trusted client address');
  verify(!upstream.headers.has('x-powered-by') && upstream.headers.get('cache-control') === 'no-store', 'API responses hide framework headers and are not cached');
  verify((await request('/api/runtime.json')).status === 200, 'API paths take priority over static file extension rules');
  const scripts = (await readdir(join(temporary, 'html', 'assets'))).filter(name => name.endsWith('.js'));
  const asset = await request('/assets/' + scripts[0]);
  verify(asset.status === 200 && asset.headers.get('cache-control')?.includes('immutable'), 'Hashed assets are cached at the edge');
  const logins = await Promise.all(Array.from({ length: 12 }, (_, index) => request('/api/auth/login', { method: 'POST', body: '{}', headers: { 'X-Forwarded-For': `198.51.100.${index}` } })));
  verify(logins.some(result => result.status === 429), 'Login burst is rate limited despite rotating spoofed forwarded headers');
  const burst = await Promise.all(Array.from({ length: 140 }, () => request('/landing')));
  verify(burst.some(result => result.status === 200) && burst.some(result => result.status === 429), 'Local traffic burst receives both normal pages and real HTTP 429 responses');
  verify(burst.filter(result => result.status === 429).every(result => result.headers.get('retry-after') === '60'), 'Rejected requests carry Retry-After');
  console.log(JSON.stringify({ checks: checks.length, result: 'passed', throttled: burst.filter(result => result.status === 429).length }, null, 2));
  if (process.argv.includes('--inspect')) {
    console.log(`Browser inspection: ${base}/landing — press Enter to stop (automatic stop after 5 minutes).`);
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { await Promise.race([once(input, 'line'), delay(300000, null, { ref: false })]); }
    finally { input.close(); }
  }
} finally {
  if (nginx && nginx.exitCode === null) {
    try { command(['-s', 'quit']); } catch { /* fallback below targets this child only */ }
    await Promise.race([once(nginx, 'exit'), delay(5000)]);
    if (nginx.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(nginx.pid), '/T', '/F'], { windowsHide: true });
      else nginx.kill();
    }
  }
  backend.closeAllConnections();
  await new Promise(resolve => backend.close(resolve));
  // Refuse recursive cleanup outside the freshly-created task directory in OS temp.
  const actual = await realpath(temporary);
  const tempRoot = await realpath(tmpdir());
  if (!actual.startsWith(tempRoot + sep) || !actual.split(sep).at(-1).startsWith('secureguard-nginx-')) throw new Error('Unsafe cleanup target');
  await rm(actual, { recursive: true, force: true });
}
