import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "../mocks/server";
import { inferVisionFrame } from "./vision";
import { setAccessToken } from "./client";

it("sends the original capture time with the JPEG", async () => {
  let received: FormData | undefined;
  setAccessToken("vision-test-token");
  server.use(
    http.post("*/api/vision/infer", async ({ request }) => {
      expect(request.headers.get("authorization")).toBe(
        "Bearer vision-test-token",
      );
      received = await request.formData();
      return HttpResponse.json({ event_delivery: "accepted" });
    }),
  );
  const capturedAt = "2026-09-23T10:00:00.123Z";
  await inferVisionFrame(
    new Blob(["jpeg"], { type: "image/jpeg" }),
    "WEB",
    capturedAt,
  );
  expect(received?.get("captured_at")).toBe(capturedAt);
  expect(received?.get("camera_id")).toBe("WEB");
  expect(received?.get("image")).toMatchObject({ type: "image/jpeg" });
  setAccessToken(null);
});
