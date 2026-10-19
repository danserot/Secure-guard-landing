import type { Incident, IncidentEvidence, PosEvent } from "./models";

const registerCameras: Record<
  string,
  { cameraId: string; cameraName: string; device: string }
> = {
  POS01: { cameraId: "D01", cameraName: "Касса 1", device: "D01 · Main 101" },
  POS02: { cameraId: "D02", cameraName: "Касса 2", device: "D02 · Sub 202" },
  POS03: { cameraId: "D03", cameraName: "Касса 3", device: "D03 · Main 301" },
};

export function calculateRisk(evidence: IncidentEvidence[]) {
  return Math.max(
    0,
    Math.min(
      100,
      evidence.reduce((total, item) => total + item.impact, 0),
    ),
  );
}

export function createIncidentFromPosEvent(event: PosEvent): Incident | null {
  const camera = registerCameras[event.registerId] ?? registerCameras.POS01;
  let evidence: IncidentEvidence[];
  let title: string;
  let description: string;
  let scenario: Incident["scenario"];

  if (event.type === "drawer_opened" && !event.metadata.authorizedReason) {
    scenario = "drawer_without_sale";
    title = "Открытие ящика без операции";
    description =
      "Денежный ящик открыт без оплаты, возврата или подтверждённой сервисной операции.";
    evidence = [
      {
        id: `${event.id}-pos`,
        kind: "pos",
        label: "Ящик открыт",
        detail: "Получено событие drawer_opened",
        impact: 45,
      },
      {
        id: `${event.id}-rule`,
        kind: "rule",
        label: "Нет разрешающей операции",
        detail: "Оплата или возврат не найдены в окне ±10 секунд",
        impact: 32,
      },
      {
        id: `${event.id}-vision`,
        kind: "vision",
        label: "Активность в CASH-зоне",
        detail: "Рука находилась в зоне денежного ящика",
        impact: 9,
      },
    ];
  } else if (
    event.type === "item_removed" &&
    event.metadata.handoverDetected === true
  ) {
    scenario = "void_after_handover";
    title = "Отмена после передачи товара";
    description =
      "Позиция удалена из чека после того, как товар был передан покупателю.";
    evidence = [
      {
        id: `${event.id}-pos`,
        kind: "pos",
        label: "Позиция удалена",
        detail: "Получено событие item_removed",
        impact: 34,
      },
      {
        id: `${event.id}-vision`,
        kind: "vision",
        label: "Передача товара",
        detail: "Трек объекта пересёк CUSTOMER-зону",
        impact: 38,
      },
      {
        id: `${event.id}-quality`,
        kind: "rule",
        label: "Качество трека",
        detail: "Уверенность наблюдения 0.86",
        impact: 6,
      },
    ];
  } else {
    return null;
  }

  const now = new Date().toISOString();
  const suffix = event.id.replace(/\D/g, "").slice(-6);
  const riskScore = calculateRisk(evidence);
  return {
    id: `INC-${suffix}`,
    riskScore,
    scenario,
    title,
    description,
    ...camera,
    occurredAt: event.occurredAt,
    status: "review",
    assignee: null,
    clipDurationSeconds: 30,
    posEventId: event.id,
    evidence,
    timeline: [
      {
        id: `${event.id}-created`,
        at: now,
        title: "Правило создало инцидент",
        detail: `Risk score ${riskScore}`,
        actor: "system",
      },
      {
        id: `${event.id}-clip`,
        at: now,
        title: "Клип подготовлен",
        detail: "30 секунд доступны для проверки",
        actor: "system",
      },
    ],
    review: null,
    createdAt: now,
    updatedAt: now,
  };
}
