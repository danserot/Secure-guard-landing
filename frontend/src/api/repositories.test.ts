import { describe, expect, it } from "vitest";
import { readDatabase } from "../data/localDatabase";
import {
  cameraConfigRepository,
  cameraRepository,
  incidentRepository,
  posEventRepository,
  settingsRepository,
} from "./repositories";

describe("mock API repositories", () => {
  it("provides typed camera inventory", async () => {
    const cameras = await cameraRepository.list();
    expect(cameras.map((camera) => camera.channel)).toEqual([
      "D01",
      "D02",
      "D03",
      "D04",
    ]);
  });

  it("lists incidents and persists a completed review", async () => {
    const incidents = await incidentRepository.list();
    const updated = await incidentRepository.update(incidents[0].id, {
      assignee: "Мария С.",
      review: {
        decision: "confirmed",
        comment: "Товар действительно передан без сканирования",
        reviewer: "Мария С.",
      },
    });

    expect(updated.status).toBe("confirmed");
    expect(updated.timeline.at(-1)?.actor).toBe("operator");
    expect(
      readDatabase().incidents.find((item) => item.id === updated.id)?.review
        ?.comment,
    ).toContain("без сканирования");
  });

  it("creates both a POS event and a linked incident for a risky scenario", async () => {
    const result = await posEventRepository.create({
      type: "drawer_opened",
      registerId: "POS02",
    });
    expect(result.createdIncidentId).not.toBeNull();
    expect(readDatabase().posEvents[0].id).toBe(result.event.id);
    expect(readDatabase().incidents[0].posEventId).toBe(result.event.id);
  });

  it("persists workspace settings", async () => {
    const settings = await settingsRepository.get();
    await settingsRepository.update({
      ...settings,
      profile: { ...settings.profile, name: "Магазин №7" },
    });
    expect((await settingsRepository.get()).profile.name).toBe("Магазин №7");
  });

  it("filters before pagination and fetches full incident POS context", async () => {
    const all = await incidentRepository.list();
    const target = all.find((row) => row.riskScore >= 80)!;
    const filtered = await incidentRepository.list({
      store_id: target.storeId,
      terminal_id: target.terminalId,
      camera_id: target.cameraId,
      min_risk: 80,
      limit: 1,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].cameraId).toBe(target.cameraId);
    expect(filtered[0].riskScore).toBeGreaterThanOrEqual(80);
    expect(
      await incidentRepository.list({ from: "2099-01-01T00:00:00Z" }),
    ).toEqual([]);
    expect(await incidentRepository.get(target.id)).toMatchObject({
      id: target.id,
      nearbyPosEvents: expect.any(Array),
      reviewHistory: expect.any(Array),
    });
  });

  it("persists unsure decisions without marking an incident confirmed", async () => {
    const [incident] = await incidentRepository.list();
    const updated = await incidentRepository.update(incident.id, {
      review: {
        decision: "unsure",
        comment: "На записи товар закрыт рукой",
        reviewer: "Оператор",
      },
    });
    expect(updated.status).toBe("unsure");
    expect(
      (await incidentRepository.list({ status: "confirmed" })).every(
        (row) => row.id !== incident.id,
      ),
    ).toBe(true);
    expect(
      (await incidentRepository.get(incident.id)).reviewHistory?.[0].label,
    ).toBe("unsure");
  });

  it("saves normalized camera zones and never accepts RTSP credentials", async () => {
    const [camera] = await cameraConfigRepository.list();
    const zones = [
      {
        id: "transfer",
        type: "transfer_zone" as const,
        points: [
          [0.1, 0.2],
          [0.8, 0.2],
          [0.8, 0.7],
        ] as [number, number][],
      },
    ];
    await cameraConfigRepository.save({ ...camera, zones });
    expect((await cameraConfigRepository.list())[0].zones).toEqual(zones);
    await expect(
      cameraConfigRepository.save({
        ...camera,
        source: "rtsp://user:secret@camera/video",
      }),
    ).rejects.toThrow("Проверьте конфигурацию камеры");
    expect((await cameraConfigRepository.list())[0].source).toMatch(/^env:/);
  });
});
