import { FilesetResolver } from "@mediapipe/tasks-vision";

export const MEDIAPIPE_VERSION = "1.0.1";

export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let visionFilesetPromise: ReturnType<
  typeof FilesetResolver.forVisionTasks
> | null = null;

export function getVisionFileset() {
  visionFilesetPromise ??= FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  );

  return visionFilesetPromise;
}
