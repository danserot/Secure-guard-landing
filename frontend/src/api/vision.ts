import { apiRequest } from "./client";

export type VisionBoundingBox = {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
};

export type VisionDetection = {
  label: string;
  class_id: number;
  confidence: number;
  bbox: VisionBoundingBox;
  center: [number, number];
  zone: string | null;
  track_id?: string | number | null;
};

export type VisionInferenceResponse = {
  request_id: string;
  camera_id: string;
  captured_at: string;
  received_at: string;
  processed_at: string;
  capture_time_source: "camera" | "server_received";
  model_id: string;
  model_revision: string;
  image_width: number;
  image_height: number;
  latency_ms: number;
  detections: VisionDetection[];
  event_delivery: "accepted" | "unavailable" | "disabled";
};

export async function inferVisionFrame(
  image: Blob,
  cameraId: string,
  capturedAt: string,
  signal?: AbortSignal,
): Promise<VisionInferenceResponse> {
  const form = new FormData();
  form.append("camera_id", cameraId);
  form.append("captured_at", capturedAt);
  form.append("image", image, "camera-frame.jpg");

  return apiRequest<VisionInferenceResponse>("/api/vision/infer", {
    method: "POST",
    body: form,
    signal,
  });
}
