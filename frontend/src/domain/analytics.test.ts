import { describe, expect, it } from "vitest";
import { summarizeIncidents } from "./analytics";
import type { Incident } from "./models";

describe("real event statistics", () => {
  it("filters camera, time and future events; counts decisions without inventing accuracy", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const row = {
      cameraId: "WEB",
      occurredAt: "2026-09-25T11:00:00Z",
      status: "review",
      review: null,
    } as Incident;
    const rows = [
      row,
      {
        ...row,
        status: "confirmed",
        clipUrl: "/clip",
        review: { reviewedAt: "2026-09-25T11:01:00Z" },
      },
      { ...row, status: "false_positive" },
      { ...row, cameraId: "OTHER" },
      { ...row, occurredAt: "2026-08-01T00:00:00Z" },
      { ...row, occurredAt: "2026-09-26T00:00:00Z" },
    ] as Incident[];
    expect(summarizeIncidents(rows, 7, "WEB", now)).toEqual({
      total: 3,
      confirmed: 1,
      falsePositive: 1,
      pending: 1,
      meanReviewSeconds: 60,
      withClips: 1,
    });
    expect(summarizeIncidents([], 7, "", now).meanReviewSeconds).toBeNull();
  });
});
