/* Public, write-only lead intake. Deploy as owner; access: Anyone. */
const SPREADSHEET_ID = '1amKkW7EBxeKOEnczDO7fFy7pA6LP2uzhXd9BPCJeec4';
const SHEET_NAME = 'Заявки';
const HEADERS = ['Дата и время', 'Номер заявки', 'Имя', 'Телефон / email', 'Город', 'Касс', 'Камера и POS', 'Статус', 'Комментарий', 'Источник', 'Согласие'];
const INTAKE_LIMITS = { bodyBytes: 10000, minute: 30, hour: 300, day: 1000, contactHour: 3, rows: 10000 };

function doGet() {
  // Never return applicants, row contents, or spreadsheet metadata.
  return json_({ service: 'secureguard-leads', version: 2 });
}

function doPost(event) {
  let lock;
  try {
    const raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || !raw || raw.length > INTAKE_LIMITS.bodyBytes
      || Utilities.newBlob(raw).getBytes().length > INTAKE_LIMITS.bodyBytes) return json_({ accepted: false, code: 'INVALID_REQUEST' });
    const mime = String(event.postData.type || '').split(';')[0].trim().toLowerCase();
    if (mime !== 'application/json' && mime !== 'text/plain') return json_({ accepted: false, code: 'INVALID_REQUEST' });
    let input;
    try { input = JSON.parse(raw); } catch (_) { return json_({ accepted: false, code: 'INVALID_REQUEST' }); }
    const lead = validateLead_(input);
    if (!lead) return json_({ accepted: false, code: 'INVALID_REQUEST' });

    lock = LockService.getScriptLock();
    if (!lock.tryLock(100)) return json_({ accepted: false, code: 'BUSY', retryAfter: 3 });
    const now = Date.now();
    const properties = PropertiesService.getScriptProperties();
    // Enforce durable quotas BEFORE opening or searching the spreadsheet.
    const wait = reserveRequest_(properties, now);
    if (wait) return json_({ accepted: false, code: 'RATE_LIMIT', retryAfter: wait });
    const fingerprint = hash_(JSON.stringify([lead.name, lead.contact, lead.city, lead.registers, lead.equipment]));
    const receiptKey = 'receipt:v2:' + lead.requestId;
    const cached = receiptCache_(receiptKey);
    if (cached) return json_(cached === fingerprint ? { accepted: true, requestId: lead.requestId } : { accepted: false, code: 'ID_CONFLICT' });
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].some((value, i) => value !== HEADERS[i])) {
      return json_({ accepted: false, code: 'NOT_CONFIGURED' });
    }

    // The same browser request ID must never append a second row on retry.
    const lastRow = sheet.getLastRow();
    // Bound fallback scans and storage growth even if an attacker rotates contacts.
    if (lastRow > INTAKE_LIMITS.rows + 1) return json_({ accepted: false, code: 'CAPACITY' });
    const existing = lastRow > 1 && sheet.getRange(2, 2, lastRow - 1, 1)
      .createTextFinder(lead.requestId).matchEntireCell(true).findNext();
    if (existing) {
      const row = sheet.getRange(existing.getRow(), 1, 1, HEADERS.length).getValues()[0];
      const matches = (value, text) => value === text || value === sheetText_(text);
      const same = matches(row[2], lead.name) && matches(row[3], lead.contact)
        && matches(row[4], lead.city) && row[5] === lead.registers && matches(row[6], lead.equipment);
      if (same) receiptCache_(receiptKey, fingerprint);
      return json_(same ? { accepted: true, requestId: lead.requestId } : { accepted: false, code: 'ID_CONFLICT' });
    }

    if (lastRow >= INTAKE_LIMITS.rows + 1) return json_({ accepted: false, code: 'CAPACITY' });
    const contactWait = reserveContact_(properties, lead.contact, now);
    if (contactWait) return json_({ accepted: false, code: 'RATE_LIMIT', retryAfter: contactWait });

    const nextRow = lastRow + 1;
    if (nextRow > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const filter = sheet.getFilter();
      if (filter) { filter.remove(); sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).createFilter(); }
    }
    const target = sheet.getRange(nextRow, 1, 1, HEADERS.length);
    // Copy formatting and status validation, never previous applicants' values.
    if (nextRow > 2) {
      const template = sheet.getRange(2, 1, 1, HEADERS.length);
      template.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      template.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    }
    target.setValues([[
      new Date(), lead.requestId, sheetText_(lead.name), sheetText_(lead.contact), sheetText_(lead.city),
      lead.registers, sheetText_(lead.equipment), 'Новая', '', 'secureguard-landing', 'Да',
    ]]);
    sheet.getRange(nextRow, 1).setNumberFormat('dd.MM.yyyy HH:mm');
    sheet.getRange(nextRow, 4).setNumberFormat('@');
    SpreadsheetApp.flush();
    receiptCache_(receiptKey, fingerprint);
    return json_({ accepted: true, requestId: lead.requestId });
  } catch (_) {
    // Do not log personal data or expose internal Google errors to visitors.
    return json_({ accepted: false, code: 'SERVICE_ERROR' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function validateLead_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.consent !== true
    || input.source !== 'secureguard-landing' || (input.website !== undefined && input.website !== '')) return null;
  if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) return null;
  const allowed = ['name', 'contact', 'city', 'registers', 'equipment', 'source', 'consent', 'requestId', 'website'];
  if (Object.keys(input).some(key => allowed.indexOf(key) === -1)) return null;
  const limits = { name: 100, contact: 180, city: 100, equipment: 2000 };
  const lead = { requestId: input.requestId, registers: input.registers };
  for (const field in limits) {
    if (typeof input[field] !== 'string' || input[field].length > limits[field]) return null;
    lead[field] = input[field].trim();
    const controls = field === 'equipment' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (controls.test(lead[field])) return null;
  }
  if (!lead.name || !lead.city || !Number.isInteger(lead.registers) || lead.registers < 1 || lead.registers > 100000) return null;
  const digits = lead.contact.replace(/\D/g, '');
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact);
  const phone = /^[+\d\s()−-]+$/.test(lead.contact) && digits.length >= 10 && digits.length <= 15;
  return email || phone ? lead : null;
}

function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function receiptCache_(key, value) {
  // Cache is optional: durable quotas and spreadsheet deduplication remain authoritative.
  try {
    const cache = CacheService.getScriptCache();
    if (value === undefined) return cache.get(key);
    cache.put(key, value, 21600);
  } catch (_) { /* A cache outage must not hide an already-persisted receipt. */ }
  return null;
}

function reserveRequest_(properties, now) {
  const state = JSON.parse(properties.getProperty('quota:v2') || '{}');
  const windows = [[60000, INTAKE_LIMITS.minute], [3600000, INTAKE_LIMITS.hour], [86400000, INTAKE_LIMITS.day]];
  let retryAfter = 0;
  for (const [duration, limit] of windows) {
    const period = Math.floor(now / duration);
    if (!state[duration] || state[duration].period !== period) state[duration] = { period, count: 0 };
    if (state[duration].count >= limit) retryAfter = Math.max(retryAfter, Math.ceil(((period + 1) * duration - now) / 1000));
  }
  if (retryAfter) return retryAfter;
  for (const [duration] of windows) state[duration].count++;
  properties.setProperty('quota:v2', JSON.stringify(state));
  return 0;
}

function reserveContact_(properties, contact, now) {
  const normalized = contact.indexOf('@') >= 0 ? contact.toLowerCase() : contact.replace(/\D/g, '');
  const key = hash_(normalized);
  // Sixteen bounded shards stay below Google's per-property value limit.
  const shardKey = 'contacts:v2:' + key[0];
  const shard = JSON.parse(properties.getProperty(shardKey) || '{}');
  for (const id of Object.keys(shard)) if (now - shard[id].start >= 3600000) delete shard[id];
  if (!shard[key]) {
    if (Object.keys(shard).length >= 60) return 3600;
    shard[key] = { start: now, count: 0 };
  }
  if (shard[key].count >= INTAKE_LIMITS.contactHour) return Math.ceil((shard[key].start + 3600000 - now) / 1000);
  shard[key].count++;
  properties.setProperty(shardKey, JSON.stringify(shard));
  return 0;
}

function sheetText_(value) {
  // Prevent formula injection, including values with leading whitespace.
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
