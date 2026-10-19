import { describe, expect, it } from "vitest";
import { calculateRisk, createIncidentFromPosEvent } from "./incidentRules";
import type { PosEvent } from "./models";

function event(
  type: PosEvent["type"],
  metadata: PosEvent["metadata"] = {},
): PosEvent {
  return {
    id: "EVT-100001",
    occurredAt: "2026-09-14T12:00:00.000Z",
    type,
    title: "Test",
    details: "Test",
    registerId: "POS01",
    registerName: "Касса 1",
    amount: null,
    status: "matched",
    videoOffsetMs: 120,
    transactionId: "TX-1",
    metadata,
    createdAt: "2026-09-14T12:00:00.000Z",
  };
}

describe("incident rules", () => {
  it("clamps an accumulated risk score", () => {
    expect(
      calculateRisk([
        { id: "1", kind: "rule", label: "a", detail: "b", impact: 130 },
      ]),
    ).toBe(100);
  });

  it("creates an explainable incident for an unauthorized drawer opening", () => {
    const incident = createIncidentFromPosEvent(event("drawer_opened"));
    expect(incident?.scenario).toBe("drawer_without_sale");
    expect(incident?.riskScore).toBe(86);
    expect(incident?.evidence).toHaveLength(3);
  });

  it("does not create an incident for an authorized drawer opening", () => {
    expect(
      createIncidentFromPosEvent(
        event("drawer_opened", { authorizedReason: "cash_collection" }),
      ),
    ).toBeNull();
  });
});
