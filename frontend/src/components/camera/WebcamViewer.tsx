import {
  Box,
  Button,
  Flex,
  NativeSelect,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { Expand, Pause, Play, RefreshCw, ScanLine, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { inferVisionFrame, type VisionDetection } from "../../api/vision";
import { captureVideoFrame } from "../../lib/vision/captureFrame";
import { createHandDetector } from "../../lib/vision/handDetector";
import { createPoseDetector } from "../../lib/vision/poseDetector";
import {
  drawHandLandmarks,
  drawLandmarks,
  isPointInsidePolygon,
  toCashGuardLandmarks,
  type CashGuardLandmarks,
  type Point,
  type PolygonDetectionZone,
} from "../../lib/vision/visionUtils";
import {
  CameraPermission,
  type CameraPermissionState,
} from "./CameraPermission";
import { PoseOverlay } from "./PoseOverlay";
import { WebcamEvidence } from "./WebcamEvidence";

type TrackingStats = {
  people: number;
  hands: number;
  fingers: number;
  fps: number;
};
type VisionState = "idle" | "loading" | "ready" | "error";
type ServerVisionState = "idle" | "processing" | "ready" | "error";

const TARGET_FRAME_INTERVAL = 1000 / 20;
const SERVER_INFERENCE_DELAY = 1500;
const SERVER_INFERENCE_TIMEOUT = 30000;
const ZONES_STORAGE_KEY = "secureguard-detection-zones-v1";

type WebcamZone = PolygonDetectionZone & { name: string; color: string };

function loadWebcamZones(): WebcamZone[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(ZONES_STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is WebcamZone => {
      if (!item || typeof item !== "object") return false;
      const zone = item as Partial<WebcamZone>;
      return (
        zone.sourceId === "WEB" &&
        typeof zone.id === "string" &&
        typeof zone.name === "string" &&
        typeof zone.color === "string" &&
        Array.isArray(zone.points) &&
        zone.points.length >= 3
      );
    });
  } catch {
    return [];
  }
}

function zoneSvgPoints(points: Point[]) {
  return points
    .map((point) => `${point.x * 1000},${point.y * 562.5}`)
    .join(" ");
}

function cameraErrorState(error: unknown): CameraPermissionState {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError")
    return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError")
    return "camera-not-found";
  if (error.name === "NotReadableError" || error.name === "AbortError")
    return "camera-busy";
  return "error";
}

function drawServerDetections(
  context: CanvasRenderingContext2D,
  detections: VisionDetection[],
  imageWidth: number,
  imageHeight: number,
) {
  if (!imageWidth || !imageHeight) return;
  const scaleX = context.canvas.width / imageWidth;
  const scaleY = context.canvas.height / imageHeight;
  const lineWidth = Math.max(3, context.canvas.width / 320);
  const fontSize = Math.max(14, context.canvas.width / 62);

  context.save();
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "top";

  detections.forEach((detection) => {
    const x = detection.bbox.x_min * scaleX;
    const y = detection.bbox.y_min * scaleY;
    const width = (detection.bbox.x_max - detection.bbox.x_min) * scaleX;
    const height = (detection.bbox.y_max - detection.bbox.y_min) * scaleY;
    const label = `${detection.label} ${Math.round(detection.confidence * 100)}%`;
    const textWidth = context.measureText(label).width;
    const labelY = Math.max(0, y - fontSize - 10);

    context.strokeStyle = "#fbbf24";
    context.lineWidth = lineWidth;
    context.strokeRect(x, y, width, height);
    context.fillStyle = "rgba(3, 7, 18, .88)";
    context.fillRect(x, labelY, textWidth + 14, fontSize + 8);
    context.fillStyle = "#fde68a";
    context.fillText(label, x + 7, labelY + 4);
  });

  context.restore();
}

export function WebcamViewer({
  autoStart = false,
  onCameraStarted,
  externalStream,
}: {
  autoStart?: boolean;
  onCameraStarted?: () => void;
  externalStream?: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(false);
  const cameraGenerationRef = useRef(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(
    null,
  );
  const poseRef = useRef<PoseLandmarker | null>(null);
  const handRef = useRef<HandLandmarker | null>(null);
  const detectorsPromiseRef = useRef<Promise<void> | null>(null);
  const detectorGenerationRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceRef = useRef(0);
  const lastStatsUpdateRef = useRef(0);
  const framesSinceStatsRef = useRef(0);
  const statsWindowStartRef = useRef(0);
  const mountedRef = useRef(true);
  const pausedRef = useRef(false);
  const latestLandmarksRef = useRef<CashGuardLandmarks | null>(null);
  const hasAutoStartedRef = useRef(false);
  const webcamZonesRef = useRef<WebcamZone[]>([]);
  const serverDetectionsRef = useRef<VisionDetection[]>([]);
  const serverImageSizeRef = useRef({ width: 0, height: 0 });

  const [permission, setPermission] = useState<CameraPermissionState>(() =>
    !window.isSecureContext || !navigator.mediaDevices?.getUserMedia ?
      "unsupported-browser"
    : "idle",
  );
  const [visionState, setVisionState] = useState<VisionState>("idle");
  const [visionError, setVisionError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [paused, setPaused] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16 / 9");
  const [stats, setStats] = useState<TrackingStats>({
    people: 0,
    hands: 0,
    fingers: 0,
    fps: 0,
  });
  const [webcamZones, setWebcamZones] = useState<WebcamZone[]>(loadWebcamZones);
  const [activeZoneIds, setActiveZoneIds] = useState<string[]>([]);
  const [serverVisionState, setServerVisionState] =
    useState<ServerVisionState>("idle");
  const [serverVisionError, setServerVisionError] = useState("");
  const [serverDetectionCount, setServerDetectionCount] = useState(0);
  const [serverLatencyMs, setServerLatencyMs] = useState(0);
  const [eventDelivery, setEventDelivery] = useState<
    "accepted" | "unavailable" | "disabled" | null
  >(null);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastVideoTimeRef.current = -1;
    lastInferenceRef.current = 0;
    clearCanvas();
  }, [clearCanvas]);

  const stopStream = useCallback(() => {
    cameraGenerationRef.current += 1;
    stopLoop();
    if (ownsStreamRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop());
    ownsStreamRef.current = false;
    streamRef.current = null;
    serverDetectionsRef.current = [];
    serverImageSizeRef.current = { width: 0, height: 0 };
    latestLandmarksRef.current = null;
    if (mountedRef.current) {
      setRecordingStream(null);
      setActiveZoneIds([]);
      setServerVisionState("idle");
      setServerVisionError("");
      setServerDetectionCount(0);
      setServerLatencyMs(0);
      setEventDelivery(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoop]);

  const closeDetectors = useCallback(() => {
    detectorGenerationRef.current += 1;
    detectorsPromiseRef.current = null;
    poseRef.current?.close();
    handRef.current?.close();
    poseRef.current = null;
    handRef.current = null;
    latestLandmarksRef.current = null;
  }, []);

  const resizeCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    const sizeChanged =
      canvas.width !== video.videoWidth || canvas.height !== video.videoHeight;
    if (!sizeChanged) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`);
  }, []);

  const startDetectionLoop = useCallback(() => {
    if (!mountedRef.current || !streamRef.current) return;
    stopLoop();
    const generation = cameraGenerationRef.current;
    statsWindowStartRef.current = performance.now();
    framesSinceStatsRef.current = 0;
    let inferenceIndex = 0;
    let poseLandmarks: NormalizedLandmark[][] = [];
    let handLandmarks: NormalizedLandmark[][] = [];

    const detect = (now: number) => {
      if (!mountedRef.current || generation !== cameraGenerationRef.current)
        return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const poseDetector = poseRef.current;
      const handDetector = handRef.current;

      if (
        video &&
        canvas &&
        poseDetector &&
        handDetector &&
        !pausedRef.current &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.currentTime !== lastVideoTimeRef.current &&
        now - lastInferenceRef.current >= TARGET_FRAME_INTERVAL
      ) {
        resizeCanvas();
        const handResult = handDetector.detectForVideo(video, now);
        handLandmarks = handResult.landmarks;
        if (inferenceIndex % 2 === 0 || poseLandmarks.length === 0) {
          poseLandmarks = poseDetector.detectForVideo(video, now).landmarks;
        }
        inferenceIndex += 1;
        const context = canvas.getContext("2d");

        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          poseLandmarks.forEach((landmarks) =>
            drawLandmarks(
              context,
              landmarks,
              PoseLandmarker.POSE_CONNECTIONS,
              "#00e5ff",
              3.2,
            ),
          );
          handLandmarks.forEach((landmarks) =>
            drawHandLandmarks(
              context,
              landmarks,
              HandLandmarker.HAND_CONNECTIONS,
            ),
          );
          drawServerDetections(
            context,
            serverDetectionsRef.current,
            serverImageSizeRef.current.width,
            serverImageSizeRef.current.height,
          );
        }

        latestLandmarksRef.current = toCashGuardLandmarks(
          poseLandmarks[0],
          handLandmarks,
        );
        lastVideoTimeRef.current = video.currentTime;
        lastInferenceRef.current = now;
        framesSinceStatsRef.current += 1;

        if (now - lastStatsUpdateRef.current >= 500) {
          const elapsed = Math.max(now - statsWindowStartRef.current, 1);
          if (mountedRef.current) {
            const landmarks = latestLandmarksRef.current;
            const trackedPoints = [
              landmarks?.leftWrist,
              landmarks?.rightWrist,
              ...(landmarks?.hands.flat() ?? []),
            ].filter((point): point is Point => Boolean(point));
            const activeZones = webcamZonesRef.current
              .filter((zone) =>
                trackedPoints.some((point) =>
                  isPointInsidePolygon({ ...point, x: 1 - point.x }, zone),
                ),
              )
              .map((zone) => zone.id);
            setStats({
              people: poseLandmarks.length,
              hands: handLandmarks.length,
              fingers: handLandmarks.length * 5,
              fps: Math.round((framesSinceStatsRef.current * 1000) / elapsed),
            });
            setActiveZoneIds(activeZones);
          }
          lastStatsUpdateRef.current = now;
          statsWindowStartRef.current = now;
          framesSinceStatsRef.current = 0;
        }
      }

      frameRef.current = requestAnimationFrame(detect);
    };

    frameRef.current = requestAnimationFrame(detect);
  }, [resizeCanvas, stopLoop]);

  const ensureDetectors = useCallback(async () => {
    if (poseRef.current && handRef.current) return;
    if (detectorsPromiseRef.current) return detectorsPromiseRef.current;
    const generation = detectorGenerationRef.current;
    setVisionState("loading");
    setVisionError("");
    const initialization = (async () => {
      try {
        const results = await Promise.allSettled([
          createPoseDetector(),
          createHandDetector(),
        ]);
        if (
          results[0].status === "rejected" ||
          results[1].status === "rejected"
        ) {
          if (results[0].status === "fulfilled") results[0].value.close();
          if (results[1].status === "fulfilled") results[1].value.close();
          throw new Error("MediaPipe initialization failed");
        }
        const pose = results[0].value;
        const hand = results[1].value;
        if (
          !mountedRef.current ||
          generation !== detectorGenerationRef.current
        ) {
          pose.close();
          hand.close();
          throw new DOMException(
            "Detector initialization cancelled",
            "AbortError",
          );
        }
        poseRef.current = pose;
        handRef.current = hand;
        setVisionState("ready");
      } catch (error) {
        if (
          mountedRef.current &&
          generation === detectorGenerationRef.current
        ) {
          setVisionState("error");
          setVisionError(
            "Не удалось загрузить Computer Vision. Проверьте подключение к интернету и повторите попытку.",
          );
        }
        throw error;
      }
    })();
    detectorsPromiseRef.current = initialization;
    try {
      await initialization;
    } finally {
      if (detectorsPromiseRef.current === initialization)
        detectorsPromiseRef.current = null;
    }
  }, []);

  const loadDevices = useCallback(async () => {
    const list = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "videoinput",
    );
    if (mountedRef.current) {
      setDevices(list);
      setDeviceId((current) => current || list[0]?.deviceId || "");
    }
  }, []);

  const requestCamera = useCallback(
    async (requestedDeviceId?: string) => {
      if (externalStream) return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setPermission("unsupported-browser");
        return;
      }

      setPermission("requesting");
      stopStream();
      const generation = cameraGenerationRef.current;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video:
            requestedDeviceId ?
              {
                deviceId: { exact: requestedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              }
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: "user",
              },
          audio: false,
        });
        if (!mountedRef.current || generation !== cameraGenerationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        ownsStreamRef.current = true;
        setRecordingStream(stream);
        setPermission("allowed");
        await loadDevices();
        if (!mountedRef.current || generation !== cameraGenerationRef.current)
          return;
        if (onCameraStarted) {
          onCameraStarted();
          return;
        }
        // A model/CDN failure must not close a working camera or its recording.
        try {
          await ensureDetectors();
          if (mountedRef.current && generation === cameraGenerationRef.current)
            startDetectionLoop();
        } catch {
          /* ensureDetectors exposes a retryable model error */
        }
      } catch (error) {
        if (!mountedRef.current || generation !== cameraGenerationRef.current)
          return;
        stopStream();
        if (mountedRef.current) setPermission(cameraErrorState(error));
      }
    },
    [
      ensureDetectors,
      externalStream,
      loadDevices,
      onCameraStarted,
      startDetectionLoop,
      stopStream,
    ],
  );

  useEffect(() => {
    if (!externalStream) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      streamRef.current = externalStream;
      ownsStreamRef.current = false;
      setRecordingStream(externalStream);
      setPermission("allowed");
      void ensureDetectors()
        .then(() => {
          if (!cancelled) startDetectionLoop();
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (streamRef.current === externalStream) stopStream();
    };
  }, [externalStream, ensureDetectors, startDetectionLoop, stopStream]);

  useEffect(() => {
    if (!autoStart || permission !== "idle" || hasAutoStartedRef.current)
      return;
    const timer = window.setTimeout(() => {
      hasAutoStartedRef.current = true;
      void requestCamera(deviceId || undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoStart, deviceId, permission, requestCamera]);

  useEffect(() => {
    mountedRef.current = true;
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("resize", onResize);
      stopStream();
      closeDetectors();
    };
  }, [closeDetectors, resizeCanvas, stopStream]);

  useEffect(() => {
    webcamZonesRef.current = webcamZones;
  }, [webcamZones]);

  useEffect(() => {
    if (permission !== "allowed" || paused || !recordingStream) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let deadline: number | undefined;
    const generation = cameraGenerationRef.current;

    const runInference = async () => {
      const video = videoRef.current;
      if (cancelled) return;
      if (
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        timer = window.setTimeout(() => void runInference(), 500);
        return;
      }

      controller = new AbortController();
      const requestController = controller;
      let timedOut = false;
      deadline = window.setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, SERVER_INFERENCE_TIMEOUT);
      setServerVisionState("processing");
      setServerVisionError("");
      setEventDelivery(null);

      try {
        const frame = await captureVideoFrame(video, requestController.signal);
        if (cancelled || generation !== cameraGenerationRef.current) return;
        requestController.signal.throwIfAborted();
        const result = await inferVisionFrame(
          frame.image,
          "WEB",
          frame.capturedAt,
          requestController.signal,
        );
        if (
          cancelled ||
          !mountedRef.current ||
          generation !== cameraGenerationRef.current
        )
          return;
        serverDetectionsRef.current = result.detections;
        serverImageSizeRef.current = {
          width: result.image_width,
          height: result.image_height,
        };
        setServerDetectionCount(result.detections.length);
        setServerLatencyMs(result.latency_ms);
        setEventDelivery(result.event_delivery);
        setServerVisionState("ready");
      } catch (error) {
        if (
          cancelled ||
          !mountedRef.current ||
          generation !== cameraGenerationRef.current
        )
          return;
        serverDetectionsRef.current = [];
        setServerDetectionCount(0);
        setServerVisionState("error");
        setEventDelivery(null);
        setServerVisionError(
          timedOut ? "Анализ кадра превысил 30 секунд"
          : error instanceof Error ? error.message
          : "Vision API недоступен",
        );
      } finally {
        window.clearTimeout(deadline);
        if (!cancelled)
          timer = window.setTimeout(
            () => void runInference(),
            SERVER_INFERENCE_DELAY,
          );
      }
    };

    timer = window.setTimeout(() => void runInference(), 250);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.clearTimeout(deadline);
      controller?.abort();
    };
  }, [paused, permission, recordingStream]);

  useEffect(() => {
    const refreshZones = () => setWebcamZones(loadWebcamZones());
    window.addEventListener("storage", refreshZones);
    window.addEventListener("focus", refreshZones);
    return () => {
      window.removeEventListener("storage", refreshZones);
      window.removeEventListener("focus", refreshZones);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (permission !== "allowed" || !video || !recordingStream) return;
    const generation = cameraGenerationRef.current;
    video.srcObject = recordingStream;
    void video.play().catch(() => {
      if (!mountedRef.current || generation !== cameraGenerationRef.current)
        return;
      stopStream();
      if (mountedRef.current) setPermission("error");
    });
  }, [permission, recordingStream, stopStream]);

  function toggleDetection() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      serverDetectionsRef.current = [];
      setEventDelivery(null);
      clearCanvas();
      setStats((current) => ({ ...current, fps: 0 }));
    }
  }

  function stopCamera() {
    stopStream();
    setPermission("idle");
    setPaused(false);
    pausedRef.current = false;
    setStats({ people: 0, hands: 0, fingers: 0, fps: 0 });
    setActiveZoneIds([]);
    serverDetectionsRef.current = [];
    serverImageSizeRef.current = { width: 0, height: 0 };
    setServerVisionState("idle");
    setServerVisionError("");
    setServerDetectionCount(0);
    setServerLatencyMs(0);
    setEventDelivery(null);
  }

  async function openFullscreen() {
    try {
      await viewerRef.current?.requestFullscreen?.();
    } catch {
      setVisionError("Браузер не разрешил полноэкранный режим.");
    }
  }

  return (
    <Box ref={viewerRef} bg="white">
      {permission !== "allowed" ?
        <CameraPermission
          state={permission}
          onRequest={() => void requestCamera(deviceId || undefined)}
        />
      : <>
          <Box
            position="relative"
            overflow="hidden"
            bg="gray.950"
            style={{ aspectRatio }}>
            <Box position="absolute" inset="0" transform="scaleX(-1)">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={resizeCanvas}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              <PoseOverlay ref={canvasRef} />
            </Box>

            {webcamZones.length > 0 && (
              <svg
                aria-hidden="true"
                viewBox="0 0 1000 562.5"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}>
                {webcamZones.map((zone) => {
                  const active = activeZoneIds.includes(zone.id);
                  return (
                    <g key={zone.id}>
                      <polygon
                        points={zoneSvgPoints(zone.points)}
                        fill={`${zone.color}${active ? "55" : "24"}`}
                        stroke="rgba(3,7,18,.95)"
                        strokeWidth={active ? 11 : 8}
                        strokeLinejoin="round"
                      />
                      <polygon
                        points={zoneSvgPoints(zone.points)}
                        fill={`${zone.color}${active ? "55" : "24"}`}
                        stroke={zone.color}
                        strokeWidth={active ? 7 : 4}
                        strokeLinejoin="round"
                      />
                      <text
                        x={zone.points[0].x * 1000 + 12}
                        y={Math.max(24, zone.points[0].y * 562.5 - 12)}
                        fill="white"
                        stroke="rgba(3,7,18,.95)"
                        strokeWidth="5"
                        paintOrder="stroke"
                        fontSize="18"
                        fontWeight="900">
                        {active ? "● " : ""}
                        {zone.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            <Flex
              position="absolute"
              top="3"
              left="3"
              right="3"
              zIndex="1"
              gap="2"
              align="center"
              wrap="wrap"
              w="fit-content"
              maxW="calc(100% - 24px)"
              borderRadius="xl"
              bg="blackAlpha.800"
              color="white"
              px="3"
              py="2"
              fontSize="xs"
              fontWeight="700"
              backdropFilter="blur(10px)">
              <ScanLine size={15} />
              <Text>
                {paused ?
                  "Paused"
                : visionState === "ready" ?
                  "Tracking"
                : "Preparing"}
              </Text>
              <Text color="whiteAlpha.700">People: {stats.people}</Text>
              <Text color="whiteAlpha.700">Hands: {stats.hands}</Text>
              <Text color="whiteAlpha.700">Fingers: {stats.fingers}</Text>
              <Text color="whiteAlpha.700">FPS: {stats.fps}</Text>
              <Text
                color={
                  serverVisionState === "ready" ? "green.200"
                  : serverVisionState === "error" ?
                    "red.200"
                  : "yellow.200"
                }>
                YOLO:{" "}
                {paused ?
                  "пауза"
                : serverVisionState === "ready" ?
                  `обработка кадра завершена · ${serverDetectionCount} объектов · ${Math.round(serverLatencyMs)} мс`
                : serverVisionState === "processing" ?
                  "анализ кадра…"
                : serverVisionState === "error" ?
                  "ошибка"
                : "ожидание"}
              </Text>
              {!paused && eventDelivery && (
                <Text
                  color={
                    eventDelivery === "accepted" ? "green.200" : "orange.200"
                  }>
                  Событие:{" "}
                  {eventDelivery === "accepted" ?
                    "принято; обработка события не подтверждена"
                  : eventDelivery === "disabled" ?
                    "отправка отключена"
                  : "не доставлено"}
                </Text>
              )}
              {webcamZones.length > 0 && (
                <Text
                  color={
                    activeZoneIds.length > 0 ? "green.200" : "whiteAlpha.700"
                  }>
                  Zones: {activeZoneIds.length}/{webcamZones.length}
                </Text>
              )}
            </Flex>

            {visionState === "loading" && (
              <Flex
                position="absolute"
                inset="0"
                zIndex="2"
                direction="column"
                align="center"
                justify="center"
                gap="3"
                bg="blackAlpha.600"
                color="white">
                <Spinner />
                <Text fontWeight="800">Загрузка Computer Vision…</Text>
              </Flex>
            )}
          </Box>

          <WebcamEvidence
            stream={recordingStream}
            active={activeZoneIds.length > 0}
            paused={paused}
          />
          {visionError && (
            <Flex
              align="center"
              justify="space-between"
              gap="4"
              bg="red.50"
              color="red.700"
              px="4"
              py="3">
              <Text fontSize="sm" fontWeight="700">
                {visionError}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const generation = cameraGenerationRef.current;
                  void ensureDetectors()
                    .then(() => {
                      if (generation === cameraGenerationRef.current)
                        startDetectionLoop();
                    })
                    .catch(() => undefined);
                }}>
                <RefreshCw size={16} /> Повторить
              </Button>
            </Flex>
          )}

          {serverVisionError && (
            <Flex
              align="center"
              gap="3"
              bg="orange.50"
              color="orange.800"
              px="4"
              py="3">
              <Text fontSize="sm" fontWeight="700">
                YOLO: {serverVisionError}. Повторная попытка выполняется
                автоматически.
              </Text>
            </Flex>
          )}

          <Flex
            direction={{ base: "column", md: "row" }}
            align={{ md: "center" }}
            justify="space-between"
            gap="3"
            borderTop="1px solid"
            borderColor="gray.100"
            p="4">
            <Flex gap="2" wrap="wrap">
              {!externalStream && (
                <Button size="sm" variant="outline" onClick={stopCamera}>
                  <Square size={16} /> Stop
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={visionState !== "ready"}
                onClick={toggleDetection}>
                {paused ?
                  <Play size={16} />
                : <Pause size={16} />}{" "}
                {paused ? "Возобновить detection" : "Pause detection"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void openFullscreen()}>
                <Expand size={16} /> На весь экран
              </Button>
            </Flex>

            {devices.length > 1 && (
              <Flex align="center" gap="2">
                <NativeSelect.Root
                  size="sm"
                  minW={{ base: "100%", md: "220px" }}>
                  <NativeSelect.Field
                    aria-label="Камера"
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}>
                    {devices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Камера ${index + 1}`}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void requestCamera(deviceId)}>
                  <RefreshCw size={16} /> Переключить
                </Button>
              </Flex>
            )}
          </Flex>
        </>
      }
    </Box>
  );
}
