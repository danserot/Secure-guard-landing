import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Point = {
  x: number;
  y: number;
  z?: number;
  confidence?: number;
};

export type DetectionZone = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PolygonDetectionZone = {
  id: string;
  sourceId: string;
  points: Point[];
};

export type CashGuardLandmarks = {
  leftWrist?: Point;
  rightWrist?: Point;
  leftElbow?: Point;
  rightElbow?: Point;
  leftShoulder?: Point;
  rightShoulder?: Point;
  hands: Point[][];
};

export type LandmarkConnection = { start: number; end: number };

const HAND_COLORS = ["#f8fafc", "#fb923c", "#a3e635", "#22d3ee", "#c084fc", "#f472b6"];
const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

function handColor(index: number) {
  if (index === 0) return HAND_COLORS[0];
  if (index <= 4) return HAND_COLORS[1];
  if (index <= 8) return HAND_COLORS[2];
  if (index <= 12) return HAND_COLORS[3];
  if (index <= 16) return HAND_COLORS[4];
  return HAND_COLORS[5];
}

export function isPointInsideZone(point: Point, zone: DetectionZone) {
  return (
    point.x >= zone.x &&
    point.x <= zone.x + zone.width &&
    point.y >= zone.y &&
    point.y <= zone.y + zone.height
  );
}

export function isPointInsidePolygon(point: Point, zone: Pick<PolygonDetectionZone, "points">) {
  if (zone.points.length < 3) return false;
  let inside = false;

  for (let current = 0, previous = zone.points.length - 1; current < zone.points.length; previous = current++) {
    const from = zone.points[current];
    const to = zone.points[previous];
    const crossesHorizontalRay = (from.y > point.y) !== (to.y > point.y);
    const boundaryX = ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y || Number.EPSILON) + from.x;
    if (crossesHorizontalRay && point.x < boundaryX) inside = !inside;
  }

  return inside;
}

function toPoint(landmark?: NormalizedLandmark): Point | undefined {
  if (!landmark) return undefined;
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    confidence: landmark.visibility,
  };
}

export function toCashGuardLandmarks(
  pose: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
): CashGuardLandmarks {
  return {
    leftShoulder: toPoint(pose?.[11]),
    rightShoulder: toPoint(pose?.[12]),
    leftElbow: toPoint(pose?.[13]),
    rightElbow: toPoint(pose?.[14]),
    leftWrist: toPoint(pose?.[15]),
    rightWrist: toPoint(pose?.[16]),
    hands: hands.map((hand) => hand.map((landmark) => toPoint(landmark)!)),
  };
}

export function drawLandmarks(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  connections: LandmarkConnection[],
  color: string,
  pointRadius: number,
) {
  const { width, height } = context.canvas;
  const lineWidth = Math.max(3, width / 220);
  const radius = Math.max(pointRadius, width / 430);
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const [strokeStyle, strokeWidth] of [["rgba(3, 7, 18, .92)", lineWidth * 2.25], [color, lineWidth]] as const) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = strokeWidth;
    for (const { start, end } of connections) {
      const from = landmarks[start];
      const to = landmarks[end];
      if (!from || !to || (from.visibility ?? 1) < 0.4 || (to.visibility ?? 1) < 0.4) continue;
      context.beginPath();
      context.moveTo(from.x * width, from.y * height);
      context.lineTo(to.x * width, to.y * height);
      context.stroke();
    }
  }

  for (const landmark of landmarks) {
    if ((landmark.visibility ?? 1) < 0.4) continue;
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, radius * 1.75, 0, Math.PI * 2);
    context.fillStyle = "rgba(3, 7, 18, .92)";
    context.fill();
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  context.restore();
}

export function drawHandLandmarks(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  connections: LandmarkConnection[],
) {
  const { width, height } = context.canvas;
  const lineWidth = Math.max(3.5, width / 210);
  const pointRadius = Math.max(4, width / 390);
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgba(3, 7, 18, .96)";
  context.lineWidth = lineWidth * 2.35;
  for (const { start, end } of connections) {
    const from = landmarks[start];
    const to = landmarks[end];
    if (!from || !to) continue;
    context.beginPath();
    context.moveTo(from.x * width, from.y * height);
    context.lineTo(to.x * width, to.y * height);
    context.stroke();
  }

  context.lineWidth = lineWidth;
  for (const { start, end } of connections) {
    const from = landmarks[start];
    const to = landmarks[end];
    if (!from || !to) continue;
    context.strokeStyle = handColor(end);
    context.beginPath();
    context.moveTo(from.x * width, from.y * height);
    context.lineTo(to.x * width, to.y * height);
    context.stroke();
  }

  landmarks.forEach((landmark, index) => {
    const radius = FINGERTIPS.has(index) ? pointRadius * 1.65 : pointRadius;
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, radius * 1.65, 0, Math.PI * 2);
    context.fillStyle = "rgba(3, 7, 18, .96)";
    context.fill();
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, radius, 0, Math.PI * 2);
    context.fillStyle = FINGERTIPS.has(index) ? "#fef08a" : handColor(index);
    context.fill();
  });

  context.restore();
}
