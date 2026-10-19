import type { Incident } from "./models";

export function summarizeIncidents(
  incidents: Incident[],
  days: number,
  cameraId: string,
  now = Date.now(),
) {
  const start = now - days * 86400000;
  const rows = incidents.filter((row) => {
    const time = Date.parse(row.occurredAt);
    return (
      time >= start && time <= now && (!cameraId || row.cameraId === cameraId)
    );
  });
  const confirmed = rows.filter((row) => row.status === "confirmed").length;
  const falsePositive = rows.filter(
    (row) => row.status === "false_positive",
  ).length;
  const reactions = rows.flatMap((row) => {
    if (!row.review) return [];
    const ms = Date.parse(row.review.reviewedAt) - Date.parse(row.occurredAt);
    return Number.isFinite(ms) && ms >= 0 ? [ms] : [];
  });
  return {
    total: rows.length,
    confirmed,
    falsePositive,
    pending: rows.length - confirmed - falsePositive,
    meanReviewSeconds:
      reactions.length ?
        Math.round(
          reactions.reduce((sum, ms) => sum + ms, 0) / reactions.length / 1000,
        )
      : null,
    withClips: rows.filter((row) => !!row.clipUrl).length,
  };
}
