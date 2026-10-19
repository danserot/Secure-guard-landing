import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getVisionFileset, POSE_MODEL_URL } from "./visionRuntime";

export async function createPoseDetector() {
  const vision = await getVisionFileset();

  const options = {
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" as const },
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    outputSegmentationMasks: false,
  };

  try {
    return await PoseLandmarker.createFromOptions(vision, options);
  } catch {
    return PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "CPU" },
    });
  }
}
