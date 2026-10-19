import { afterEach, describe, expect, it, vi } from "vitest";
import { captureVideoFrame } from "./captureFrame";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("frame capture time", () => {
  it("keeps pixel capture time even when JPEG encoding finishes later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    let finishEncoding: BlobCallback | undefined;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => {
        finishEncoding = callback;
      },
    );
    const frame = captureVideoFrame(document.createElement("video"));
    expect(drawImage).toHaveBeenCalledOnce();
    vi.setSystemTime(new Date("2026-09-23T10:00:05Z"));
    finishEncoding!(new Blob(["jpeg"], { type: "image/jpeg" }));
    expect((await frame).capturedAt).toBe("2026-09-23T10:00:00.000Z");
  });

  it("rejects cancelled encoding immediately and ignores its late JPEG", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    let finishEncoding: BlobCallback | undefined;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => {
        finishEncoding = callback;
      },
    );
    const controller = new AbortController();
    const frame = captureVideoFrame(
      document.createElement("video"),
      controller.signal,
    );
    controller.abort();
    await expect(frame).rejects.toMatchObject({ name: "AbortError" });
    finishEncoding!(new Blob(["late-jpeg"], { type: "image/jpeg" }));
    await expect(frame).rejects.toMatchObject({ name: "AbortError" });
  });
});
