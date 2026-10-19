/* Public, write-only lead intake. Deploy as owner; access: Anyone. */
const SPREADSHEET_ID = '1amKkW7EBxeKOEnczDO7fFy7pA6LP2uzhXd9BPCJeec4';
const SHEET_NAME = 'Заявки';
const HEADERS = ['Дата и время', 'Номер заявки', 'Имя', 'Телефон / email', 'Город', 'Касс', 'Камера и POS', 'Статус', 'Комментарий', 'Источник', 'Согласие'];

function doGet() {
  // Never return applicants, row contents, or spreadsheet metadata.
  return json_({ service: 'secureguard-leads', version: 1 });
}

function doPost(event) {
  let lock;
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 10000) return json_({ accepted: false, code: 'INVALID_REQUEST' });
    let input;
    try { input = JSON.parse(raw); } catch (_) { return json_({ accepted: false, code: 'INVALID_REQUEST' }); }
    const lead = validateLead_(input);
    if (!lead) return json_({ accepted: false, code: 'INVALID_REQUEST' });

    lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) return json_({ accepted: false, code: 'BUSY' });
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].some((value, i) => value !== HEADERS[i])) {
      return json_({ accepted: false, code: 'NOT_CONFIGURED' });
    }

    // The same browser request ID must never append a second row on retry.
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1 && sheet.getRange(2, 2, lastRow - 1, 1)
      .createTextFinder(lead.requestId).matchEntireCell(true).findNext();
    if (existing) {
      const row = sheet.getRange(existing.getRow(), 1, 1, HEADERS.length).getValues()[0];
      const matches = (value, text) => value === text || value === sheetText_(text);
      const same = matches(row[2], lead.name) && matches(row[3], lead.contact)
        && matches(row[4], lead.city) && row[5] === lead.registers && matches(row[6], lead.equipment);
      return json_(same ? { accepted: true, requestId: lead.requestId } : { accepted: false, code: 'ID_CONFLICT' });
    }

    // Best-effort global flood guard; not a replacement for a CAPTCHA at scale.
    const cache = CacheService.getScriptCache();
    const key = 'minute:' + Math.floor(Date.now() / 60000);
    const count = Number(cache.get(key) || 0);
    if (count >= 30) return json_({ accepted: false, code: 'RATE_LIMIT' });
    cache.put(key, String(count + 1), 120);

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
  const limits = { name: 100, contact: 180, city: 100, equipment: 2000 };
  const lead = { requestId: input.requestId, registers: input.registers };
  for (const field in limits) {
    if (typeof input[field] !== 'string' || input[field].length > limits[field]) return null;
    lead[field] = input[field].trim();
  }
  if (!lead.name || !lead.city || !Number.isInteger(lead.registers) || lead.registers < 1 || lead.registers > 100000) return null;
  const digits = lead.contact.replace(/\D/g, '');
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact);
  const phone = /^[+\d\s()−-]+$/.test(lead.contact) && digits.length >= 10 && digits.length <= 15;
  return email || phone ? lead : null;
}

function sheetText_(value) {
  // Prevent formula injection, including values with leading whitespace.
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
