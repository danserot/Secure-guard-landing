import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadForm } from './LeadForm';

function fillForm(contact = 'owner@example.test') {
  fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: 'Артём' } });
  fireEvent.change(screen.getByLabelText('Телефон или email'), { target: { value: contact } });
  fireEvent.change(screen.getByLabelText('Город'), { target: { value: 'Алматы' } });
  fireEvent.change(screen.getByLabelText('Количество касс'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('Lead intake confirmation', () => {
  beforeEach(() => vi.stubEnv('VITE_LEAD_ENDPOINT', '/api/leads'));
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('does not send or claim success when no receiver is configured', async () => {
    vi.stubEnv('VITE_LEAD_ENDPOINT', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<LeadForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Данные не отправлены');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/Заявка принята/)).not.toBeInTheDocument();
  });

  it('rejects invalid contact details before making a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<LeadForm />);
    fillForm('123');
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('корректный email или телефон');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires a durable receipt, not just a successful HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 200 })));
    render(<LeadForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Подтверждение приёма не получено');
    expect(screen.queryByText(/Заявка принята/)).not.toBeInTheDocument();
  });

  it('shows an error for an unavailable service and keeps entered values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    render(<LeadForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Сервис не подтвердил');
    expect(screen.getByLabelText('Ваше имя')).toHaveValue('Артём');
    expect(screen.getByRole('button', { name: /Обсудить подключение/ })).toBeEnabled();
  });

  it('shows loading and confirms only the accepted response with receipt', async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchSpy = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal('fetch', fetchSpy);
    render(<LeadForm />);
    fillForm('+7 (777) 123-45-67');
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(screen.getByRole('button', { name: /Отправляем/ })).toBeDisabled();
    resolveRequest(new Response(JSON.stringify({ accepted: true, requestId: 'lead-42' }), { status: 201 }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Заявка принята. Номер: lead-42'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(sent).toMatchObject({ name: 'Артём', registers: 1, consent: true, source: 'secureguard-landing' });
    expect(screen.getByRole('button', { name: 'Заявка принята' })).toBeDisabled();
  });

  it('does not mistake an SPA HTML fallback for an accepted lead', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Fallback</html>', { status: 200 })));
    render(<LeadForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('без подтверждения приёма');
    expect(screen.queryByText(/Заявка принята/)).not.toBeInTheDocument();
  });

  it('explains a network failure in Russian without clearing the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<LeadForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Обсудить подключение/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Проверьте соединение');
    expect(screen.getByLabelText('Телефон или email')).toHaveValue('owner@example.test');
  });
});
