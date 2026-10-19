import type {
  Camera,
  Incident,
  PosEvent,
  ProductDatabase,
  WorkspaceSettings,
} from "../domain/models";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function timeline(id: string, occurredAt: string, risk: number) {
  return [
    {
      id: `${id}-detected`,
      at: occurredAt,
      title: "Модель создала событие",
      detail: `Risk score ${risk}`,
      actor: "system" as const,
    },
    {
      id: `${id}-clip`,
      at: new Date(new Date(occurredAt).getTime() + 12_000).toISOString(),
      title: "Клип подготовлен",
      detail: "Видео доступно для проверки",
      actor: "system" as const,
    },
  ];
}

export function createSeedIncidents(): Incident[] {
  const seeds: Array<Omit<Incident, "timeline" | "createdAt" | "updatedAt">> = [
    {
      id: "INC-2048",
      riskScore: 92,
      scenario: "unscanned_item",
      title: "Товар без сканирования",
      description:
        "Объект перемещён в зону покупателя без соответствующего item_added в POS.",
      cameraId: "D01",
      cameraName: "Касса 1",
      device: "D01 · Main 101",
      occurredAt: minutesAgo(8),
      status: "review",
      assignee: "Алина К.",
      clipDurationSeconds: 30,
      posEventId: null,
      evidence: [
        {
          id: "E-2048-1",
          kind: "vision",
          label: "Объект в BAG-зоне",
          detail: "Трек пересёк границу зоны покупателя",
          impact: 38,
        },
        {
          id: "E-2048-2",
          kind: "pos",
          label: "Нет item_added",
          detail: "POS-событие не найдено в окне ±4 секунды",
          impact: 36,
        },
        {
          id: "E-2048-3",
          kind: "rule",
          label: "Стабильный трек",
          detail: "Уверенность отслеживания 0.91",
          impact: 18,
        },
      ],
      review: null,
    },
    {
      id: "INC-2047",
      riskScore: 86,
      scenario: "drawer_without_sale",
      title: "Открытие денежного ящика",
      description:
        "Денежный ящик открыт без платежа, возврата или сервисной операции.",
      cameraId: "D02",
      cameraName: "Касса 2",
      device: "D02 · Sub 202",
      occurredAt: minutesAgo(35),
      status: "review",
      assignee: null,
      clipDurationSeconds: 24,
      posEventId: "EVT-89241",
      evidence: [
        {
          id: "E-2047-1",
          kind: "pos",
          label: "drawer_opened",
          detail: "Ящик открыт в 12:18:04",
          impact: 45,
        },
        {
          id: "E-2047-2",
          kind: "rule",
          label: "Нет разрешающей операции",
          detail: "Оплата и возврат не найдены",
          impact: 32,
        },
        {
          id: "E-2047-3",
          kind: "vision",
          label: "Активность в CASH-зоне",
          detail: "Зафиксировано движение руки",
          impact: 9,
        },
      ],
      review: null,
    },
    {
      id: "INC-2046",
      riskScore: 78,
      scenario: "void_after_handover",
      title: "Отмена после передачи товара",
      description: "Позиция удалена из чека после передачи товара покупателю.",
      cameraId: "D01",
      cameraName: "Касса 1",
      device: "D01 · Main 101",
      occurredAt: minutesAgo(94),
      status: "awaiting_pos",
      assignee: "Руслан М.",
      clipDurationSeconds: 30,
      posEventId: null,
      evidence: [
        {
          id: "E-2046-1",
          kind: "vision",
          label: "Передача товара",
          detail: "Объект пересёк CUSTOMER-зону",
          impact: 38,
        },
        {
          id: "E-2046-2",
          kind: "pos",
          label: "Ожидание синхронизации",
          detail: "POS gateway повторяет доставку",
          impact: 34,
        },
        {
          id: "E-2046-3",
          kind: "rule",
          label: "Качество трека",
          detail: "Уверенность 0.84",
          impact: 6,
        },
      ],
      review: null,
    },
    {
      id: "INC-2045",
      riskScore: 64,
      scenario: "duplicate_scan",
      title: "Повторное сканирование",
      description:
        "Зафиксировано повторное движение товара через зону сканера.",
      cameraId: "D03",
      cameraName: "Касса 3",
      device: "D03 · Main 301",
      occurredAt: minutesAgo(170),
      status: "confirmed",
      assignee: "Мария С.",
      clipDurationSeconds: 18,
      posEventId: "EVT-89238",
      evidence: [
        {
          id: "E-2045-1",
          kind: "vision",
          label: "Два прохода",
          detail: "Один трек дважды пересёк SCANNER-зону",
          impact: 36,
        },
        {
          id: "E-2045-2",
          kind: "pos",
          label: "Одна позиция",
          detail: "В чеке зарегистрирован один item_added",
          impact: 28,
        },
      ],
      review: {
        decision: "confirmed",
        comment: "Проверено по клипу: товар прошёл сканер дважды.",
        reviewer: "Мария С.",
        reviewedAt: minutesAgo(150),
      },
    },
    {
      id: "INC-2044",
      riskScore: 41,
      scenario: "staff_absence",
      title: "Долгое отсутствие кассира",
      description: "Рабочая зона оставалась без сотрудника более пяти минут.",
      cameraId: "D02",
      cameraName: "Касса 2",
      device: "D02 · Sub 202",
      occurredAt: minutesAgo(1080),
      status: "false_positive",
      assignee: "Алина К.",
      clipDurationSeconds: 45,
      posEventId: null,
      evidence: [
        {
          id: "E-2044-1",
          kind: "vision",
          label: "Нет позы в STAFF-зоне",
          detail: "Сотрудник не обнаружен 5 минут",
          impact: 41,
        },
      ],
      review: {
        decision: "false_positive",
        comment: "Касса была официально закрыта на перерыв.",
        reviewer: "Алина К.",
        reviewedAt: minutesAgo(1050),
      },
    },
  ];

  return seeds.map((item) => {
    const baseTimeline = timeline(item.id, item.occurredAt, item.riskScore);
    const reviewEntry =
      item.review ?
        [
          {
            id: `${item.id}-review`,
            at: item.review.reviewedAt,
            title:
              item.review.decision === "confirmed" ?
                "Инцидент подтверждён"
              : "Отмечено как ложная тревога",
            detail: item.review.comment,
            actor: "operator" as const,
          },
        ]
      : [];
    return {
      ...item,
      timeline: [...baseTimeline, ...reviewEntry],
      createdAt: item.occurredAt,
      updatedAt: item.review?.reviewedAt ?? item.occurredAt,
    };
  });
}

export function createSeedPosEvents(): PosEvent[] {
  return [
    {
      id: "EVT-89241",
      occurredAt: minutesAgo(35),
      type: "drawer_opened",
      title: "Открытие денежного ящика",
      details: "Сервисное основание не передано",
      registerId: "POS02",
      registerName: "Касса 2",
      amount: null,
      status: "matched",
      videoOffsetMs: 340,
      transactionId: "TX-49281",
      metadata: {},
      createdAt: minutesAgo(35),
    },
    {
      id: "EVT-89240",
      occurredAt: minutesAgo(40),
      type: "payment_completed",
      title: "Оплата завершена",
      details: "Банковская карта · чек №8401",
      registerId: "POS01",
      registerName: "Касса 1",
      amount: 3480,
      status: "matched",
      videoOffsetMs: -180,
      transactionId: "TX-49280",
      metadata: {},
      createdAt: minutesAgo(40),
    },
    {
      id: "EVT-89239",
      occurredAt: minutesAgo(43),
      type: "item_added",
      title: "Товар добавлен",
      details: "SKU 4607012345678 · 1 шт.",
      registerId: "POS01",
      registerName: "Касса 1",
      amount: 790,
      status: "matched",
      videoOffsetMs: 120,
      transactionId: "TX-49280",
      metadata: { sku: "4607012345678" },
      createdAt: minutesAgo(43),
    },
    {
      id: "EVT-89238",
      occurredAt: minutesAgo(170),
      type: "item_removed",
      title: "Товар удалён",
      details: "SKU 4607011110009 · отмена позиции",
      registerId: "POS03",
      registerName: "Касса 3",
      amount: 450,
      status: "pending_video",
      videoOffsetMs: null,
      transactionId: "TX-49265",
      metadata: { sku: "4607011110009" },
      createdAt: minutesAgo(170),
    },
    {
      id: "EVT-89237",
      occurredAt: minutesAgo(245),
      type: "refund_completed",
      title: "Возврат завершён",
      details: "Возврат по чеку №8374",
      registerId: "POS02",
      registerName: "Касса 2",
      amount: 1290,
      status: "error",
      videoOffsetMs: null,
      transactionId: "TX-49251",
      metadata: {},
      createdAt: minutesAgo(245),
    },
  ];
}

export function createSeedSettings(): WorkspaceSettings {
  return {
    profile: {
      name: "SecureGuard — Центральный",
      address: "Стамбул, торговый зал №1",
      timezone: "Europe/Istanbul",
      language: "Русский",
    },
    notifications: {
      criticalIncidents: true,
      cameraOffline: true,
      dailyReport: true,
      serviceUpdates: false,
    },
    storage: {
      ordinaryRetentionDays: 30,
      confirmedRetentionDays: 180,
      automaticCleanup: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function createSeedCameras(): Camera[] {
  return [
    {
      channel: "D01",
      name: "Касса 1",
      device: "DS-7104H",
      ip: "192.168.1.41",
      rtsp: "rtsp://user:***@192.168.1.41:554/Streaming/channels/101",
      stream: "Main 101",
      status: "Online",
      bitrate: "1536 Kbps",
      fps: "8 FPS",
      recording: "Event recording",
    },
    {
      channel: "D02",
      name: "Касса 2",
      device: "DS-7104H",
      ip: "192.168.1.42",
      rtsp: "rtsp://user:***@192.168.1.42:554/Streaming/channels/202",
      stream: "Sub 202",
      status: "Setup",
      bitrate: "256 Kbps",
      fps: "0 FPS",
      recording: "Paused",
    },
    {
      channel: "D03",
      name: "Касса 3",
      device: "DS-7104H",
      ip: "192.168.1.43",
      rtsp: "rtsp://user:***@192.168.1.43:554/Streaming/channels/301",
      stream: "Main 301",
      status: "Offline",
      bitrate: "0 Kbps",
      fps: "0 FPS",
      recording: "Stopped",
    },
    {
      channel: "D04",
      name: "Касса 4",
      device: "DS-7104H",
      ip: "Не назначен",
      rtsp: "Не настроен",
      stream: "Main 401",
      status: "Empty",
      bitrate: "0 Kbps",
      fps: "0 FPS",
      recording: "Disabled",
    },
  ];
}

export function createSeedDatabase(): ProductDatabase {
  return {
    version: 1,
    cameras: createSeedCameras(),
    incidents: createSeedIncidents(),
    posEvents: createSeedPosEvents(),
    settings: createSeedSettings(),
  };
}
