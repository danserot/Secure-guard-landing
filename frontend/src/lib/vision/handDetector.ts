import { HandLandmarker } from "@mediapipe/tasks-vision";
import { getVisionFileset, HAND_MODEL_URL } from "./visionRuntime";

export async function createHandDetector() {
  const vision = await getVisionFileset();

  const options = {
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" as const },
    runningMode: "VIDEO" as const,
    numHands: 2,
    minHandDetectionConfidence: 0.45,
    minHandPresenceConfidence: 0.45,
    minTrackingConfidence: 0.55,
  };

  try {
    return await HandLandmarker.createFromOptions(vision, options);
  } catch {
    return HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
    });
  }
}
