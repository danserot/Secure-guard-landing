import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const headers = ['Дата и время', 'Номер заявки', 'Имя', 'Телефон / email', 'Город', 'Касс', 'Камера и POS', 'Статус', 'Комментарий', 'Источник', 'Согласие'];
const valid = { name: 'Тест', contact: '+7 777 123 45 67', city: 'Алматы', registers: 1, equipment: '=HYPERLINK("https://example.test")', source: 'secureguard-landing', consent: true, requestId: 'f74e4f2a-f42d-45e2-8bac-a85540d31880', website: '' };

function fixture({ failWrite = false, locked = false, rate = 0 } = {}) {
  const rows = [headers];
  const written = [];
  let released = false;
  let flushed = false;
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getRange(row, col, height = 1, width = 1) {
      return {
        getValues: () => rows.slice(row - 1, row - 1 + height).map(r => r.slice(col - 1, col - 1 + width)),
        createTextFinder: needle => ({ matchEntireCell() { return this; }, findNext: () => {
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
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush: () => { flushed = true; }, CopyPasteType: { PASTE_FORMAT: 'format', PASTE_DATA_VALIDATION: 'validation' } },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, hasLock: () => !locked, releaseLock: () => { released = true; } }) },
    CacheService: { getScriptCache: () => ({ get: () => String(rate), put() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  };
  runInNewContext(source, sandbox);
  return { send: input => sandbox.doPost({ postData: { contents: JSON.stringify(input) } }), rows, written, state: () => ({ flushed, released }), sandbox };
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
  assert.equal(f.sandbox.doPost({ postData: { contents: 'not-json' } }).accepted, false);
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
  assert.deepEqual(f.sandbox.doGet(), { service: 'secureguard-leads', version: 1 });
});
