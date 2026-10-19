import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const source = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const headers = ['Дата и время', 'Номер заявки', 'Имя', 'Телефон / email', 'Город', 'Касс', 'Камера и POS', 'Статус', 'Комментарий', 'Источник', 'Согласие'];
const valid = { name: 'Тест', contact: '+7 777 123 45 67', city: 'Алматы', registers: 1, equipment: '=HYPERLINK("https://example.test")', source: 'secureguard-landing', consent: true, requestId: 'f74e4f2a-f42d-45e2-8bac-a85540d31880', website: '' };

function fixture({ failWrite = false, locked = false, rate = 0, evict = false, initialRows, failProperties = false, failCache = false } = {}) {
  const rows = initialRows || [headers];
  let now = Date.UTC(2026, 9, 19, 6, 0, 0);
  const properties = new Map();
  const cache = new Map();
  if (rate) properties.set('quota:v2', JSON.stringify({ 60000: { period: Math.floor(now / 60000), count: rate } }));
  const written = [];
  let opens = 0;
  let scanned = 0;
  let released = false;
  let flushed = false;
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getRange(row, col, height = 1, width = 1) {
      return {
        getValues: () => rows.slice(row - 1, row - 1 + height).map(r => r.slice(col - 1, col - 1 + width)),
        createTextFinder: needle => ({ matchEntireCell() { return this; }, findNext: () => {
          scanned += height;
          const index = rows.findIndex((r, i) => i > 0 && r[1] === needle);
          return index > 0 ? { getRow: () => index + 1 } : null;
        } }),
        setValues(values) {
          if (failWrite) throw new Error('private provider failure');
          written.push(...values);
          // Sheets interprets a leading apostrophe as literal-text escaping.
          rows[row - 1] = values[0].map(v => typeof v === 'string' ? v.replace(/^'/, '') : v);
        },
        setNumberFormat() {},
        copyTo() {},
      };
    },
  };
  const sandbox = {
    Date: class extends Date { static now() { return now; } },
    Utilities: { newBlob: text => ({ getBytes: () => [...Buffer.from(text)] }), computeDigest: (_, text) => [...createHash('sha256').update(text).digest()], DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) || null, setProperty: (key, value) => { if (failProperties) throw new Error('quota store unavailable'); assert.ok(Buffer.byteLength(value) < 9000); properties.set(key, value); } }) },
    SpreadsheetApp: { openById: () => { opens++; return { getSheetByName: () => sheet }; }, flush: () => { flushed = true; }, CopyPasteType: { PASTE_FORMAT: 'format', PASTE_DATA_VALIDATION: 'validation' } },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, hasLock: () => !locked, releaseLock: () => { released = true; } }) },
    CacheService: { getScriptCache: () => { if (failCache) throw new Error('cache unavailable'); return { get: key => evict ? null : cache.get(key) || null, put: (key, value) => cache.set(key, value) }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  };
  runInNewContext(source, sandbox);
  return { send: input => sandbox.doPost({ postData: { contents: JSON.stringify(input), type: 'text/plain;charset=utf-8' } }), rows, written, state: () => ({ flushed, released }), sandbox, properties, counts: () => ({ opens, scanned }), advance: ms => { now += ms; } };
}

test('writes the exact sheet schema, preserves phone and neutralizes spreadsheet formulas', () => {
  const f = fixture();
  const result = f.send(valid);
  assert.equal(result.accepted, true);
  assert.equal(result.requestId, valid.requestId);
  assert.equal(f.written[0].length, 11);
  assert.equal(f.rows[1][3], valid.contact);
  assert.equal(f.written[0][6], "'" + valid.equipment);
  assert.equal(f.rows[1][7], 'Новая');
  assert.deepEqual(f.state(), { flushed: true, released: true });
});

test('retries return the original receipt without adding a duplicate phone lead', () => {
  const f = fixture();
  assert.equal(f.send(valid).accepted, true);
  assert.equal(f.send(valid).accepted, true);
  assert.equal(f.rows.length, 2);
  assert.equal(f.send({ ...valid, city: 'Астана' }).code, 'ID_CONFLICT');
  assert.equal(f.rows.length, 2);
});

test('rejects missing consent, invalid values, bot fields and malformed JSON before writing', () => {
  const f = fixture();
  for (const patch of [{ consent: false }, { consent: 'true' }, { contact: '123' }, { registers: 0 }, { registers: 1.5 }, { registers: 100001 }, { requestId: 'bad' }, { website: 'bot.test' }, { name: 'x'.repeat(101) }]) {
    assert.equal(f.send({ ...valid, ...patch }).accepted, false);
  }
  assert.equal(f.sandbox.doPost({ postData: { contents: 'not-json', type: 'text/plain' } }).accepted, false);
  assert.equal(f.rows.length, 1);
});

test('write failures never acknowledge acceptance and always release the lock', () => {
  const f = fixture({ failWrite: true });
  assert.equal(f.send(valid).code, 'SERVICE_ERROR');
  assert.deepEqual(f.state(), { flushed: false, released: true });
});

test('busy locks and rate limits reject without writing', () => {
  const busy = fixture({ locked: true });
  assert.equal(busy.send(valid).code, 'BUSY');
  assert.equal(busy.rows.length, 1);
  const limited = fixture({ rate: 30 });
  assert.equal(limited.send(valid).code, 'RATE_LIMIT');
  assert.equal(limited.rows.length, 1);
});

test('health response does not expose applicants or sheet identifiers', () => {
  const f = fixture();
  assert.deepEqual(f.sandbox.doGet(), { service: 'secureguard-leads', version: 2 });
});

const numbered = (index, contact = `test${index}@example.test`) => ({ ...valid, requestId: `f74e4f2a-f42d-45e2-8bac-${String(index).padStart(12, '0')}`, contact });

test('durable request quota survives total cache eviction and blocks before Sheets access', () => {
  const f = fixture({ evict: true });
  for (let i = 1; i <= 30; i++) assert.equal(f.send(numbered(i)).accepted, true);
  const before = f.counts();
  const rejected = f.send(numbered(31));
  assert.equal(rejected.code, 'RATE_LIMIT');
  assert.equal(rejected.retryAfter, 60);
  assert.deepEqual(f.counts(), before);
  f.advance(61000);
  assert.equal(f.send(numbered(31)).accepted, true);
});

test('contact throttle normalizes phone formatting and does not block an idempotent retry', () => {
  const f = fixture({ evict: true });
  for (let i = 1; i <= 3; i++) assert.equal(f.send(numbered(i, i === 2 ? '87771234567' : '8 (777) 123-45-67')).accepted, true);
  assert.equal(f.send(numbered(3, '8 (777) 123-45-67')).accepted, true);
  assert.equal(f.send(numbered(4, '8 777 123 45 67')).code, 'RATE_LIMIT');
  assert.equal(f.rows.length, 4);
  f.advance(3600001);
  assert.equal(f.send(numbered(4, '8 777 123 45 67')).accepted, true);
});

test('rejects oversized UTF-8, unsupported MIME, unknown fields and controls without Sheets access', () => {
  const f = fixture();
  assert.equal(f.sandbox.doPost({ postData: { contents: JSON.stringify({ ...valid, extra: '😀'.repeat(2600) }), type: 'text/plain' } }).code, 'INVALID_REQUEST');
  assert.equal(f.sandbox.doPost({ postData: { contents: JSON.stringify(valid), type: 'text/html' } }).code, 'INVALID_REQUEST');
  assert.equal(f.send({ ...valid, injected: 'x' }).code, 'INVALID_REQUEST');
  assert.equal(f.send({ ...valid, name: 'Fake\nName' }).code, 'INVALID_REQUEST');
  assert.equal(f.counts().opens, 0);
});

test('stops spreadsheet growth and fallback scans at the configured capacity', () => {
  const rows = Array.from({ length: 10002 }, () => []);
  rows[0] = headers;
  const f = fixture({ initialRows: rows });
  assert.equal(f.send(valid).code, 'CAPACITY');
  assert.equal(f.counts().scanned, 0);
});

test('fails closed if the durable quota store is unavailable', () => {
  const f = fixture({ failProperties: true });
  assert.equal(f.send(valid).code, 'SERVICE_ERROR');
  assert.equal(f.counts().opens, 0);
});

test('cache outages preserve durable receipts and spreadsheet deduplication', () => {
  const f = fixture({ failCache: true });
  assert.equal(f.send(valid).accepted, true);
  assert.equal(f.send(valid).accepted, true);
  assert.equal(f.rows.length, 2);
});
