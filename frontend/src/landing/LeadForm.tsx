import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, Download, LoaderCircle } from 'lucide-react';

type Lead = { name: string; contact: string; city: string; registers: number; equipment: string };

export function LeadForm() {
  const endpoint = (import.meta.env.VITE_LEAD_ENDPOINT ?? '').trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const pending = useRef<{ body: string; requestId: string } | null>(null);

  function readLead(form: HTMLFormElement): Lead | null {
    const data = new FormData(form);
    const lead = { name: String(data.get('name') ?? '').trim(), contact: String(data.get('contact') ?? '').trim(), city: String(data.get('city') ?? '').trim(), registers: Number(data.get('registers')), equipment: String(data.get('equipment') ?? '').trim() };
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact);
    const phone = /^[+\d\s()−-]+$/.test(lead.contact) && lead.contact.replace(/\D/g, '').length >= 10 && lead.contact.replace(/\D/g, '').length <= 15;
    if (!lead.name || !lead.city || !Number.isInteger(lead.registers) || lead.registers < 1) {
      setError('Укажите имя, город и количество касс — целое число от 1.');
      return null;
    }
    if (!email && !phone) {
      setError('Укажите корректный email или телефон с кодом страны, от 10 до 15 цифр.');
      form.querySelector<HTMLInputElement>('[name="contact"]')?.focus();
      return null;
    }
    return lead;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setReceipt('');
    const lead = readLead(event.currentTarget);
    if (!lead) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (!endpoint) {
      setError('Онлайн-приём заявок ещё не подключён. Данные не отправлены. Скачайте заполненную анкету кнопкой ниже.');
      return;
    }
    const data = new FormData(form);
    const payload = { ...lead, source: 'secureguard-landing', consent: data.get('consent') === 'on', website: String(data.get('website') ?? '') };
    const body = JSON.stringify(payload);
    if (pending.current?.body !== body) pending.current = { body, requestId: crypto.randomUUID() };
    const requestId = pending.current.requestId;
    const googleScript = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), googleScript ? 30000 : 15000);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': googleScript ? 'text/plain;charset=utf-8' : 'application/json' }, body: JSON.stringify({ ...payload, requestId }), credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Сервис не подтвердил приём заявки. Проверьте связь и попробуйте ещё раз.');
      const result: unknown = await response.json().catch(() => {
        throw new Error('Сервис вернул ответ без подтверждения приёма. Уточните статус заявки у команды перед повторной отправкой.');
      });
      if (typeof result === 'object' && result !== null && 'code' in result && (result.code === 'RATE_LIMIT' || result.code === 'BUSY')) throw new Error('Сервис занят. Подождите минуту и повторите отправку.');
      if (typeof result !== 'object' || result === null || !('accepted' in result) || result.accepted !== true || !('requestId' in result) || typeof result.requestId !== 'string' || !result.requestId.trim()) throw new Error('Подтверждение приёма не получено. Не отправляйте заявку повторно, пока не проверите её статус у команды.');
      setReceipt(result.requestId);
    } catch (requestError) {
      setError(requestError instanceof DOMException && requestError.name === 'AbortError' ? 'Время ожидания истекло. Подтверждение не получено; заявка могла дойти до сервиса. Уточните её статус перед повторной отправкой.' : requestError instanceof TypeError ? 'Нет подтверждения от сервиса. Проверьте соединение; если заявка могла дойти, уточните её статус перед повторной отправкой.' : requestError instanceof Error ? requestError.message : 'Не удалось отправить данные. Попробуйте позже.');
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  function download(form: HTMLFormElement) {
    setError('');
    if (!form.reportValidity()) return;
    const lead = readLead(form);
    if (!lead) return;
    const body = `Анкета для обсуждения пилота SecureGuard\n\nИмя: ${lead.name}\nКонтакт: ${lead.contact}\nГород: ${lead.city}\nКоличество касс: ${lead.registers}\nКамера и POS: ${lead.equipment || 'Нужно уточнить'}\n\nАнкета сохранена локально. Это не отправленная заявка.`;
    const url = URL.createObjectURL(new Blob(['\uFEFF', body], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SecureGuard-пилот.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }

  return <form className="sg-lead-form" onSubmit={submit} aria-labelledby="sg-form-title" onChange={() => { setError(''); setDownloaded(false); setReceipt(''); }}>
    <div className="sg-form-heading"><h3 id="sg-form-title">Расскажите о вашей кассе</h3><span>Первый шаг к пилоту</span></div>
    <fieldset className="sg-form-fields" disabled={busy}>
    <div className="sg-form-grid">
      <label className="sg-field">Ваше имя<input name="name" placeholder="Как к вам обращаться" autoComplete="name" required maxLength={100} /></label>
      <label className="sg-field">Телефон или email<input name="contact" placeholder="+7 … или name@company.kz" autoComplete="email" required maxLength={180} aria-describedby={error ? 'sg-form-error' : undefined} /></label>
      <label className="sg-field">Город<input name="city" placeholder="Например, Алматы" autoComplete="address-level2" required maxLength={100} /></label>
      <label className="sg-field">Количество касс<input name="registers" type="number" placeholder="1" min="1" max="100000" step="1" inputMode="numeric" required /></label>
      <label className="sg-field sg-field-full">Камера и POS-система <span>необязательно</span><textarea name="equipment" placeholder="Модели оборудования, название кассовой программы или ваш вопрос" rows={3} maxLength={2000} /></label>
    </div>
    <label className="sg-consent"><input name="consent" type="checkbox" required /><span>Согласен на обработку указанных данных для обсуждения подключения SecureGuard.</span></label>
    <label className="sg-honeypot" aria-hidden="true">Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label>
    </fieldset>
    {!endpoint && <p className="sg-form-notice">Онлайн-приём заявок пока не подключён. Заполненную анкету можно скачать — данные останутся у вас.</p>}
    {error && <p id="sg-form-error" className="sg-form-error" role="alert">{error}</p>}
    {receipt && <p className="sg-form-success" role="status"><CheckCircle2 size={18} />Заявка принята. Номер: {receipt}</p>}
    <button type="submit" className="sg-button sg-button-primary sg-form-submit" disabled={busy || Boolean(receipt)}>{busy ? <><LoaderCircle className="sg-spin" size={18} /> Отправляем…</> : receipt ? 'Заявка принята' : <>Обсудить подключение <ArrowUpRight size={19} /></>}</button>
    {!endpoint && <button className="sg-download" type="button" onClick={(event) => download(event.currentTarget.form!)}><Download size={16} /> Скачать заполненную анкету</button>}
    {downloaded && <p className="sg-download-status" role="status">Анкета подготовлена для скачивания. Данные никуда не отправлены.</p>}
  </form>;
}
