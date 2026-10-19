export type RecordedEvent = {
  id: string;
  occurredAt: string;
  startedAt: string;
  endedAt: string;
  reason: "manual" | "zone_activity";
  clip: Blob;
};

// Each segment has its own WebM header; arbitrary MediaRecorder chunks cannot
// be spliced into a playable prebuffer. At most one 10s segment lives in memory.
export class ClipRecorder {
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private pending: {
    occurredAt: string;
    reason: RecordedEvent["reason"];
  } | null = null;
  private cooldownUntil = 0;

  private stream: MediaStream;
  private onClip: (event: RecordedEvent) => void;
  private onError: (message: string) => void;

  constructor(
    stream: MediaStream,
    onClip: (event: RecordedEvent) => void,
    onError: (message: string) => void,
  ) {
    this.stream = stream;
    this.onClip = onClip;
    this.onError = onError;
    this.rotate();
  }

  mark(reason: RecordedEvent["reason"]): boolean {
    if (
      this.stopped ||
      this.pending ||
      Date.now() < this.cooldownUntil ||
      this.recorder?.state !== "recording"
    )
      return false;
    this.pending = { occurredAt: new Date().toISOString(), reason };
    this.cooldownUntil = Date.now() + 30000;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.recorder?.stop(), 3000);
    return true;
  }

  stop() {
    this.stopped = true;
    this.pending = null;
    clearTimeout(this.timer);
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  private rotate() {
    if (this.stopped) return;
    try {
      this.startSegment();
    } catch {
      this.stop();
      this.onError(
        "Не удалось начать запись видео. Проверьте камеру и повторите попытку.",
      );
    }
  }

  private startSegment() {
    const startedAt = new Date().toISOString();
    const chunks: Blob[] = [];
    let bytes = 0;
    const recorder = new MediaRecorder(this.stream, {
      mimeType: "video/webm",
      videoBitsPerSecond: 1500000,
    });
    this.recorder = recorder;
    recorder.ondataavailable = ({ data }) => {
      bytes += data.size;
      if (bytes > 12 * 1024 * 1024) {
        this.stop();
        this.onError("Запись остановлена: клип превышает 12 MiB");
      } else if (!this.stopped) chunks.push(data);
    };
    recorder.onerror = () => {
      this.stop();
      this.onError("Ошибка записи видео. Перезапустите запись.");
    };
    recorder.onstop = () => {
      if (this.stopped) return;
      const pending = this.pending;
      this.pending = null;
      if (pending)
        this.onClip({
          id: crypto.randomUUID(),
          ...pending,
          startedAt,
          endedAt: new Date().toISOString(),
          clip: new Blob(chunks, { type: "video/webm" }),
        });
      this.rotate();
    };
    recorder.start(1000);
    this.timer = setTimeout(() => recorder.stop(), 10000);
  }
}
