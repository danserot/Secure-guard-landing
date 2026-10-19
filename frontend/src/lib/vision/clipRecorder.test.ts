import { afterEach, expect, it, vi } from "vitest";
import { ClipRecorder } from "./clipRecorder";

class Recorder {
  static instances: Recorder[] = [];
  state = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  constructor() {
    Recorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["segment"]) });
    this.onstop?.();
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Recorder.instances = [];
});

it("rotates standalone segments, limits repeats and cancels unfinished evidence", () => {
  vi.useFakeTimers();
  vi.stubGlobal("MediaRecorder", Recorder);
  const onClip = vi.fn();
  const recorder = new ClipRecorder({} as MediaStream, onClip, vi.fn());
  vi.advanceTimersByTime(10000);
  expect(onClip).not.toHaveBeenCalled();
  expect(Recorder.instances).toHaveLength(2);
  expect(recorder.mark("manual")).toBe(true);
  expect(recorder.mark("zone_activity")).toBe(false);
  vi.advanceTimersByTime(3000);
  expect(onClip).toHaveBeenCalledTimes(1);
  expect(onClip.mock.calls[0][0].clip.type).toBe("video/webm");
  expect(recorder.mark("manual")).toBe(false);
  vi.advanceTimersByTime(30000);
  expect(recorder.mark("manual")).toBe(true);
  recorder.stop();
  vi.advanceTimersByTime(3000);
  expect(onClip).toHaveBeenCalledTimes(1);
});

it("reports a recorder startup error without leaving a timer or throwing into the UI", () => {
  vi.useFakeTimers();
  class BrokenRecorder {
    constructor() {
      throw new Error("Camera ended");
    }
  }
  vi.stubGlobal("MediaRecorder", BrokenRecorder);
  const onError = vi.fn();
  const recorder = new ClipRecorder({} as MediaStream, vi.fn(), onError);
  expect(onError).toHaveBeenCalledOnce();
  expect(recorder.mark("manual")).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
