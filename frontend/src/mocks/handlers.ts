import { delay, http, HttpResponse } from "msw";
import { z } from "zod";
import type { CameraConfig, CreatePosEventInput, Incident, IncidentPatch, PosEvent, Store, Terminal, WorkspaceSettings } from "../domain/models";
import { createIncidentFromPosEvent } from "../domain/incidentRules";
import { posEventTypeLabels } from "../domain/formatters";
import { readDatabase, updateDatabase } from "../data/localDatabase";
import { summarizeIncidents } from "../domain/analytics";

const incidentPatchSchema = z.object({
  assignee: z.string().nullable().optional(),
  review: z.object({
    decision: z.enum(["confirmed", "false_positive", "unsure"]),
    comment: z.string().trim().min(3),
    reviewer: z.string().trim().min(2),
  }).optional(),
});

const posEventSchema = z.object({
  type: z.enum(["item_added", "item_removed", "payment_completed", "drawer_opened", "refund_completed"]),
  registerId: z.enum(["POS01", "POS02", "POS03"]),
  amount: z.number().nonnegative().nullable().optional(),
  sku: z.string().trim().optional(),
  authorizedReason: z.string().trim().optional(),
});

const settingsSchema = z.object({
  profile: z.object({ name: z.string().min(2), address: z.string().min(2), timezone: z.string().min(2), language: z.string().min(2) }),
  notifications: z.object({ criticalIncidents: z.boolean(), cameraOffline: z.boolean(), dailyReport: z.boolean(), serviceUpdates: z.boolean() }),
  storage: z.object({ ordinaryRetentionDays: z.number().int().min(1).max(365), confirmedRetentionDays: z.number().int().min(1).max(1095), automaticCleanup: z.boolean() }),
  updatedAt: z.string(),
});

const latency = import.meta.env.MODE === "test" ? 0 : 180;
const wait = () => delay(latency);

function notFound(entity: string) {
  return HttpResponse.json({ message: `${entity} не найден` }, { status: 404 });
}

function mockStores(): Store[] {
  return readDatabase().stores ?? [{ id: "store-demo", name: "Демонстрационный магазин", timezone: "Asia/Almaty" }];
}

function mockTerminals(): Terminal[] {
  return readDatabase().terminals ?? [1, 2, 3, 4].map((id) => ({ id: `POS0${id}`, store_id: "store-demo", name: `Касса ${id}` }));
}

function mockConfigs(): CameraConfig[] {
  const database = readDatabase();
  return database.cameraConfigs?.slice().sort((a, b) => a.camera_id.localeCompare(b.camera_id)) ?? database.cameras.map((camera) => ({
    camera_id: camera.channel, name: camera.name, store_id: "store-demo", terminal_id: `POS0${camera.channel.slice(-1)}`,
    source: `env:RTSP_${camera.channel}`, enabled: camera.status !== "Empty", target_fps: 5, product_labels: ["product"], zones: [],
    health: { stream_alive: camera.status === "Online", fps_input: camera.status === "Online" ? 15 : 0, fps_processed: camera.status === "Online" ? 5 : 0, decode_latency_ms: null, last_seen: camera.status === "Online" ? new Date().toISOString() : null, last_error: null },
  }));
}

function withLocation(incident: Incident): Incident {
  return { ...incident, storeId: incident.storeId ?? "store-demo", terminalId: incident.terminalId ?? `POS0${incident.cameraId.slice(-1)}` };
}

const cameraConfigSchema = z.object({
  camera_id: z.string().min(1), store_id: z.string().min(1), terminal_id: z.string().min(1), name: z.string().min(1),
  source: z.string().regex(/^(env:[A-Z][A-Z0-9_]*|\d+)$/), enabled: z.boolean(), target_fps: z.number().min(1).max(30),
  product_labels: z.array(z.string().min(1)).min(1), zones: z.array(z.object({ id: z.string().min(1),
    type: z.enum(["cashier_zone", "scan_zone", "transfer_zone", "customer_zone", "drawer_zone"]),
    points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(3),
  })),
});

export const handlers = [
  http.get("*/api/v1/audit", () => HttpResponse.json([])),
  http.get("*/api/auth/me", () => HttpResponse.json({ id: "demo-admin", email: "operator@example.test", role: "admin", organizationId: "demo" })),
  http.get("*/api/v1/cameras", () => HttpResponse.json(mockConfigs())),
  http.put("*/api/v1/cameras/:id", async ({ params, request }) => {
    const parsed = cameraConfigSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.camera_id !== params.id) return HttpResponse.json({ detail: "Проверьте конфигурацию камеры" }, { status: 422 });
    const configs = mockConfigs();
    const existing = configs.find((camera) => camera.camera_id === params.id);
    const config = { ...parsed.data, health: existing?.health };
    updateDatabase((database) => ({ ...database, cameraConfigs: [...configs.filter((camera) => camera.camera_id !== params.id), config] }));
    return HttpResponse.json(config);
  }),
  http.get("*/api/v1/stores", () => HttpResponse.json(mockStores())),
  http.get("*/api/v1/terminals", () => HttpResponse.json(mockTerminals())),
  http.post("*/api/v1/stores", async ({ request }) => {
    const parsed = z.object({ id: z.string().min(1), name: z.string().min(1), timezone: z.string().min(1) }).safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ detail: "Проверьте магазин" }, { status: 422 });
    const stores = mockStores();
    if (stores.some((store) => store.id === parsed.data.id)) return HttpResponse.json({ detail: "Магазин уже существует" }, { status: 409 });
    updateDatabase((database) => ({ ...database, stores: [...stores, parsed.data] }));
    return HttpResponse.json(parsed.data, { status: 201 });
  }),
  http.post("*/api/v1/terminals", async ({ request }) => {
    const parsed = z.object({ id: z.string().min(1), store_id: z.string().min(1), name: z.string().min(1) }).safeParse(await request.json());
    if (!parsed.success || !mockStores().some((store) => store.id === parsed.data.store_id)) return HttpResponse.json({ detail: "Проверьте кассу и магазин" }, { status: 422 });
    const terminals = mockTerminals();
    if (terminals.some((terminal) => terminal.id === parsed.data.id)) return HttpResponse.json({ detail: "Касса уже существует" }, { status: 409 });
    updateDatabase((database) => ({ ...database, terminals: [...terminals, parsed.data] }));
    return HttpResponse.json(parsed.data, { status: 201 });
  }),
  http.get("*/api/v1/analytics", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const days = Number(params.get("days") ?? 30);
    const camera = params.get("camera_id") ?? "";
    const incidents = readDatabase().incidents;
    const summary = summarizeIncidents(incidents, days, camera);
    const highRisk = incidents.filter((row) => row.riskScore >= 80 && row.status !== "false_positive" && (!camera || camera === row.cameraId) && Date.parse(row.occurredAt) >= Date.now() - days * 86400000).length;
    return HttpResponse.json({ ...summary, highRisk });
  }),
  http.post("*/api/webcam-events", () => HttpResponse.json({ detail: "Запись реальной веб-камеры недоступна в demo" }, { status: 409 })),
  http.get("*/api/incidents/:id/clip", () => HttpResponse.json({ detail: "В demo нет записанного клипа" }, { status: 404 })),
  http.get("*/api/runtime", () => HttpResponse.json({
    demoMode: true, dataSource: "browser", posIntegration: "demo",
  })),
  http.get("*/api/cameras", async () => {
    await wait();
    return HttpResponse.json(readDatabase().cameras);
  }),

  http.get("*/api/incidents", async ({ request }) => {
    await wait();
    const params = new URL(request.url).searchParams;
    const incidents = readDatabase().incidents.map(withLocation).filter((row) =>
      (!params.get("store_id") || row.storeId === params.get("store_id")) &&
      (!params.get("terminal_id") || row.terminalId === params.get("terminal_id")) &&
      (!params.get("camera_id") || row.cameraId === params.get("camera_id")) &&
      (!params.get("status") || row.status === params.get("status")) &&
      row.riskScore >= Number(params.get("min_risk") ?? 0) &&
      (!params.get("from") || Date.parse(row.occurredAt) >= Date.parse(params.get("from")!)) &&
      (!params.get("to") || Date.parse(row.occurredAt) <= Date.parse(params.get("to")!))
    ).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const offset = Number(params.get("offset") ?? 0);
    return HttpResponse.json(incidents.slice(offset, offset + Number(params.get("limit") ?? 100)));
  }),

  http.get("*/api/incidents/:id", ({ params }) => {
    const database = readDatabase();
    const incident = database.incidents.find((row) => row.id === params.id);
    if (!incident) return notFound("Инцидент");
    return HttpResponse.json({ ...withLocation(incident), nearbyPosEvents: database.posEvents.filter((event) => event.id === incident.posEventId || (event.registerId === withLocation(incident).terminalId && Math.abs(Date.parse(event.occurredAt) - Date.parse(incident.occurredAt)) <= 30_000)), reviewHistory: incident.review ? [{ id: `${incident.id}-review`, label: incident.review.decision, note: incident.review.comment, reviewer_id: incident.review.reviewer, created_at: incident.review.reviewedAt }] : [] });
  }),

  http.patch("*/api/incidents/:id", async ({ params, request }) => {
    await wait();
    const parsed = incidentPatchSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ message: "Проверьте данные решения" }, { status: 400 });
    let updated = null;
    updateDatabase((database) => ({
      ...database,
      incidents: database.incidents.map((incident) => {
        if (incident.id !== params.id) return incident;
        const patch = parsed.data as IncidentPatch;
        const now = new Date().toISOString();
        const review = patch.review ? { ...patch.review, reviewedAt: now } : incident.review;
        const status = patch.review?.decision ?? incident.status;
        const assignmentChanged = patch.assignee !== undefined && patch.assignee !== incident.assignee;
        const timeline = [...incident.timeline];
        if (assignmentChanged) timeline.push({ id: `${incident.id}-assignment-${Date.now()}`, at: now, title: "Назначен ответственный", detail: patch.assignee ?? "Ответственный снят", actor: "operator" });
        if (patch.review) timeline.push({ id: `${incident.id}-review-${Date.now()}`, at: now, title: patch.review.decision === "confirmed" ? "Инцидент подтверждён" : patch.review.decision === "unsure" ? "Недостаточно данных" : "Отмечено как ложная тревога", detail: patch.review.comment, actor: "operator" });
        updated = { ...incident, ...patch, review, status, timeline, updatedAt: now };
        return updated;
      }),
    }));
    return updated ? HttpResponse.json(updated) : notFound("Инцидент");
  }),

  http.get("*/api/pos-events", async ({ request }) => {
    await wait();
    const params = new URL(request.url).searchParams;
    const offset = Number(params.get("offset") ?? 0);
    return HttpResponse.json(readDatabase().posEvents.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(offset, offset + Number(params.get("limit") ?? 100)));
  }),

  http.post("*/api/pos-events", async ({ request }) => {
    await wait();
    const parsed = posEventSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ message: "Проверьте параметры POS-события" }, { status: 400 });
    const input = parsed.data as CreatePosEventInput;
    const now = new Date().toISOString();
    const id = `EVT-${Date.now().toString().slice(-7)}`;
    const registerNumber = input.registerId.slice(-1);
    const event: PosEvent = {
      id, occurredAt: now, type: input.type, title: posEventTypeLabels[input.type],
      details: input.sku ? `SKU ${input.sku} · тестовое событие` : "Сгенерировано в тестовом POS Gateway",
      registerId: input.registerId, registerName: `Касса ${registerNumber}`, amount: input.amount ?? null,
      status: "matched", videoOffsetMs: Math.round(Math.random() * 500 - 250), transactionId: `TX-${Date.now().toString().slice(-6)}`,
      metadata: {
        ...(input.sku ? { sku: input.sku } : {}),
        ...(input.authorizedReason ? { authorizedReason: input.authorizedReason } : {}),
        ...(input.type === "item_removed" ? { handoverDetected: true } : {}),
        generated: true,
      },
      createdAt: now,
    };
    const incident = createIncidentFromPosEvent(event);
    updateDatabase((database) => ({
      ...database,
      posEvents: [event, ...database.posEvents],
      incidents: incident ? [incident, ...database.incidents.filter((item) => item.id !== incident.id)] : database.incidents,
    }));
    return HttpResponse.json({ event, createdIncidentId: incident?.id ?? null }, { status: 201 });
  }),

  http.post("*/api/pos-events/synchronize", async () => {
    await wait();
    const database = updateDatabase((current) => ({ ...current, posEvents: current.posEvents.map((event) =>
      event.status === "error" || event.status === "pending_video" ? { ...event, status: "matched", videoOffsetMs: event.videoOffsetMs ?? 0 } : event) }));
    return HttpResponse.json(database.posEvents);
  }),

  http.post("*/api/pos-events/:id/retry", async ({ params }) => {
    await wait();
    let updated = null;
    updateDatabase((database) => ({ ...database, posEvents: database.posEvents.map((event) => {
      if (event.id !== params.id) return event;
      updated = { ...event, status: "matched" as const, videoOffsetMs: event.videoOffsetMs ?? 0 };
      return updated;
    }) }));
    return updated ? HttpResponse.json(updated) : notFound("POS-событие");
  }),

  http.get("*/api/settings", async () => {
    await wait();
    return HttpResponse.json(readDatabase().settings);
  }),

  http.put("*/api/settings", async ({ request }) => {
    await wait();
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ message: "Проверьте настройки" }, { status: 400 });
    const settings = { ...(parsed.data as WorkspaceSettings), updatedAt: new Date().toISOString() };
    updateDatabase((database) => ({ ...database, settings }));
    return HttpResponse.json(settings);
  }),
];
