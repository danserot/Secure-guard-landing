import type {
  IncidentScenario,
  IncidentStatus,
  PosEventStatus,
  PosEventType,
} from "./models";

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  review: "На проверке",
  awaiting_pos: "Ожидает POS",
  confirmed: "Подтверждён",
  false_positive: "Ложная тревога",
  unsure: "Недостаточно данных",
};

export const incidentScenarioLabels: Record<IncidentScenario, string> = {
  webcam_observation: "Событие веб-камеры для проверки",
  unscanned_item: "Товар без сканирования",
  drawer_without_sale: "Открытие ящика без операции",
  void_after_handover: "Отмена после передачи товара",
  duplicate_scan: "Повторное сканирование",
  staff_absence: "Долгое отсутствие кассира",
};

export const posStatusLabels: Record<PosEventStatus, string> = {
  matched: "Сопоставлено",
  pending_video: "Ожидает видео",
  error: "Ошибка",
  ignored: "Игнорировано",
};

export const posEventTypeLabels: Record<PosEventType, string> = {
  transaction_started: "Чек открыт",
  item_added: "Товар добавлен",
  item_removed: "Товар удалён",
  payment_completed: "Оплата завершена",
  drawer_opened: "Открытие денежного ящика",
  refund_completed: "Возврат завершён",
};

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}
