import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { inferVisionFrame } from "../../api/vision";
import {
  captureVideoFrame,
  type CapturedFrame,
} from "../../lib/vision/captureFrame";
import { createHandDetector } from "../../lib/vision/handDetector";
import { createPoseDetector } from "../../lib/vision/poseDetector";
import { WebcamViewer } from "./WebcamViewer";

vi.mock("../../api/vision", () => ({ inferVisionFrame: vi.fn() }));
vi.mock("../../lib/vision/captureFrame", () => ({
  captureVideoFrame: vi.fn(),
}));
vi.mock("../../lib/vision/poseDetector", () => ({
  createPoseDetector: vi.fn(),
}));
vi.mock("../../lib/vision/handDetector", () => ({
  createHandDetector: vi.fn(),
}));

const frame: CapturedFrame = {
  image: new Blob(["jpeg"]),
  capturedAt: "2026-10-09T10:00:00Z",
};
const mediaDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);

function mediaStream() {
  const stop = vi.fn();
  return {
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
  };
}

function viewer(stream?: MediaStream) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["runtime"], {
    demoMode: false,
    dataSource: "postgresql",
    posIntegration: "not_configured",
  });
  const tree = (source?: MediaStream) => (
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={client}>
        <WebcamViewer externalStream={source} />
      </QueryClientProvider>
    </ChakraProvider>
  );
  return { ...render(tree(stream)), tree, client };
}

beforeEach(() => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(2);
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(
    1280,
  );
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(
    720,
  );
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.mocked(createPoseDetector).mockResolvedValue({
    close: vi.fn(),
  } as unknown as PoseLandmarker);
  vi.mocked(createHandDetector).mockResolvedValue({
    close: vi.fn(),
  } as unknown as HandLandmarker);
  vi.mocked(captureVideoFrame).mockResolvedValue(frame);
  vi.mocked(inferVisionFrame).mockResolvedValue({
    request_id: "test-frame",
    camera_id: "WEB",
    captured_at: frame.capturedAt,
    received_at: frame.capturedAt,
    processed_at: frame.capturedAt,
    capture_time_source: "camera",
    model_id: "test-model",
    model_revision: "test-revision",
    detections: [],
    image_width: 1280,
    image_height: 720,
    latency_ms: 10,
    event_delivery: "accepted",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (mediaDescriptor)
    Object.defineProperty(navigator, "mediaDevices", mediaDescriptor);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

it("does not upload a JPEG that finishes encoding after analysis was paused", async () => {
  let finishEncoding: ((value: CapturedFrame) => void) | undefined;
  vi.mocked(captureVideoFrame).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishEncoding = resolve;
      }),
  );
  const borrowed = mediaStream();
  const { unmount, client } = viewer(borrowed.stream);
  await waitFor(() => expect(captureVideoFrame).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Pause detection" }));
  await act(async () => {
    finishEncoding!(frame);
  });
  expect(inferVisionFrame).not.toHaveBeenCalled();
  unmount();
  expect(borrowed.stop).not.toHaveBeenCalled();
  client.clear();
});

it("stops a local camera granted after the viewer was removed", async () => {
  let grant: ((value: MediaStream) => void) | undefined;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const camera = mediaStream();
  const { unmount, client } = viewer();
  fireEvent.click(
    screen.getByRole("button", { name: "Разрешить доступ к камере" }),
  );
  expect(grant).toBeDefined();
  unmount();
  await act(async () => {
    grant!(camera.stream);
  });
  expect(camera.stop).toHaveBeenCalledOnce();
  expect(createPoseDetector).not.toHaveBeenCalled();
  client.clear();
});

it("shares detector initialization while switching streams and closes late models after unmount", async () => {
  let finishPose: ((value: PoseLandmarker) => void) | undefined;
  let finishHand: ((value: HandLandmarker) => void) | undefined;
  const pose = { close: vi.fn() };
  const hand = { close: vi.fn() };
  vi.mocked(createPoseDetector).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishPose = resolve;
      }),
  );
  vi.mocked(createHandDetector).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishHand = resolve;
      }),
  );
  const first = mediaStream();
  const second = mediaStream();
  const { rerender, unmount, tree, container, client } = viewer(first.stream);
  await waitFor(() => expect(createPoseDetector).toHaveBeenCalledOnce());
  rerender(tree(second.stream));
  await waitFor(() =>
    expect(container.querySelector("video")?.srcObject).toBe(second.stream),
  );
  expect(createPoseDetector).toHaveBeenCalledOnce();
  expect(createHandDetector).toHaveBeenCalledOnce();
  unmount();
  await act(async () => {
    finishPose!(pose as unknown as PoseLandmarker);
    finishHand!(hand as unknown as HandLandmarker);
  });
  expect(pose.close).toHaveBeenCalledOnce();
  expect(hand.close).toHaveBeenCalledOnce();
  expect(first.stop).not.toHaveBeenCalled();
  expect(second.stop).not.toHaveBeenCalled();
  client.clear();
});

it("keeps one slow inference in flight, reports its deadline and cancels its resources", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.mocked(inferVisionFrame).mockImplementation(
    (_image, _camera, _capturedAt, requestSignal) =>
      new Promise((_resolve, reject) => {
        signal = requestSignal;
        requestSignal!.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  const { unmount, client } = viewer(mediaStream().stream);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(inferVisionFrame).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(29999);
  });
  expect(inferVisionFrame).toHaveBeenCalledOnce();
  expect(signal?.aborted).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(signal?.aborted).toBe(true);
  expect(
    screen.getByText(/Анализ кадра превысил 30 секунд/),
  ).toBeInTheDocument();
  unmount();
  client.clear();
  expect(vi.getTimerCount()).toBe(0);
});
