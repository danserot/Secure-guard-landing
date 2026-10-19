export type CapturedFrame = { image: Blob; capturedAt: string };

export function captureVideoFrame(
  video: HTMLVideoElement,
  signal?: AbortSignal,
): Promise<CapturedFrame> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context)
    return Promise.reject(new Error("Не удалось подготовить кадр камеры"));
  // Timestamp the pixels we capture, before asynchronous JPEG encoding/upload.
  const capturedAt = new Date().toISOString();
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal?.reason);
    signal?.addEventListener("abort", aborted, { once: true });
    try {
      canvas.toBlob(
        (image) => {
          signal?.removeEventListener("abort", aborted);
          if (signal?.aborted) return;
          if (image) resolve({ image, capturedAt });
          else reject(new Error("Не удалось сформировать изображение"));
        },
        "image/jpeg",
        0.82,
      );
    } catch (error) {
      signal?.removeEventListener("abort", aborted);
      reject(error);
    }
  });
}
