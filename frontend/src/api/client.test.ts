import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { server } from "../mocks/server";
import { apiRequest, getAccessToken, setAccessToken } from "./client";

afterEach(() => setAccessToken(null));

it("invalidates an expired session so protected data can be cleared", async () => {
  setAccessToken("expired-test-token");
  const changed = vi.fn();
  window.addEventListener("secureguard:session-changed", changed);
  server.use(http.get("*/api/auth/me", ({ request }) => {
    expect(request.headers.get("authorization")).toBe("Bearer expired-test-token");
    return HttpResponse.json({ detail: "Сессия истекла" }, { status: 401 });
  }));
  await expect(apiRequest("/api/auth/me")).rejects.toThrow("Сессия истекла");
  expect(getAccessToken()).toBeNull();
  expect(changed).toHaveBeenCalledOnce();
  window.removeEventListener("secureguard:session-changed", changed);
});

it("preserves a new login when an older request returns a delayed 401", async () => {
  setAccessToken("old-test-token");
  let release: (() => void) | undefined;
  server.use(http.get("*/api/auth/me", async () => {
    await new Promise<void>((resolve) => { release = resolve; });
    return HttpResponse.json({ detail: "Old session expired" }, { status: 401 });
  }));
  const request = apiRequest("/api/auth/me");
  await waitFor(() => expect(release).toBeDefined());
  setAccessToken("new-test-token");
  release!();
  await expect(request).rejects.toThrow("Old session expired");
  expect(getAccessToken()).toBe("new-test-token");
});
