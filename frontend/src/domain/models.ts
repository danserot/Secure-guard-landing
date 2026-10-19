export type IncidentStatus =
  | "review"
  | "awaiting_pos"
  | "confirmed"
  | "false_positive"
  | "unsure";
export type ReviewDecision = "confirmed" | "false_positive" | "unsure";

export type Camera = {
  channel: string;
  name: string;
  device: string;
  ip: string;
  rtsp: string;
  stream: string;
  status: "Online" | "Setup" | "Offline" | "Empty";
  bitrate: string;
  fps: string;
  recording: string;
};

export type IncidentScenario =
  | "webcam_observation"
  | "unscanned_item"
  | "drawer_without_sale"
  | "void_after_handover"
  | "duplicate_scan"
  | "staff_absence";

export type EvidenceKind = "vision" | "pos" | "rule";

export type IncidentEvidence = {
  id: string;
  kind: EvidenceKind;
  label: string;
  detail: string;
  impact: number;
};

export type IncidentTimelineEntry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  actor: "system" | "operator";
};

export type IncidentReview = {
  decision: ReviewDecision;
  comment: string;
  reviewer: string;
  reviewedAt: string;
};

export type Incident = {
  id: string;
  riskScore: number;
  scenario: IncidentScenario;
  title: string;
  description: string;
  cameraId: string;
  storeId?: string;
  terminalId?: string;
  visionEventId?: string;
  cameraName: string;
  device: string;
  occurredAt: string;
  status: IncidentStatus;
  assignee: string | null;
  clipDurationSeconds: number;
  clipUrl?: string;
  clipStartedAt?: string;
  clipEndedAt?: string;
  posEventId: string | null;
  evidence: IncidentEvidence[];
  timeline: IncidentTimelineEntry[];
  review: IncidentReview | null;
  createdAt: string;
  updatedAt: string;
  nearbyPosEvents?: PosEvent[];
  reviewHistory?: {
    id: string;
    label: ReviewDecision;
    note: string | null;
    reviewer_id: string;
    created_at: string;
  }[];
};

export type IncidentReviewInput = {
  decision: ReviewDecision;
  comment: string;
  reviewer: string;
};

export type IncidentPatch = {
  assignee?: string | null;
  review?: IncidentReviewInput;
};

export type IncidentFilters = {
  store_id?: string;
  terminal_id?: string;
  camera_id?: string;
  status?: IncidentStatus;
  min_risk?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type CameraZoneType =
  | "cashier_zone"
  | "scan_zone"
  | "transfer_zone"
  | "customer_zone"
  | "drawer_zone";
export type CameraZone = {
  id: string;
  type: CameraZoneType;
  points: [number, number][];
};
export type CameraHealth = {
  stream_alive: boolean;
  fps_input: number | null;
  fps_processed: number | null;
  decode_latency_ms: number | null;
  last_seen: string | null;
  last_error: string | null;
};
export type CameraConfig = {
  camera_id: string;
  store_id: string;
  terminal_id: string;
  name: string;
  source: string;
  enabled: boolean;
  target_fps: number;
  product_labels: string[];
  zones: CameraZone[];
  health?: CameraHealth | null;
};
export type Store = { id: string; name: string; timezone: string };
export type Terminal = { id: string; store_id: string; name: string };
export type CurrentUser = {
  id: string;
  email: string;
  role: "admin" | "manager" | "operator" | "reviewer" | "viewer";
  organizationId: string;
};

export type PosEventType =
  | "transaction_started"
  | "item_added"
  | "item_removed"
  | "payment_completed"
  | "drawer_opened"
  | "refund_completed";

export type PosEventStatus = "matched" | "pending_video" | "error" | "ignored";

export type PosEvent = {
  id: string;
  occurredAt: string;
  type: PosEventType;
  title: string;
  details: string;
  registerId: string;
  registerName: string;
  amount: number | null;
  status: PosEventStatus;
  videoOffsetMs: number | null;
  transactionId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreatePosEventInput = {
  type: PosEventType;
  registerId: string;
  amount?: number | null;
  sku?: string;
  authorizedReason?: string;
};

export type CreatePosEventResult = {
  event: PosEvent;
  createdIncidentId: string | null;
};

export type WorkspaceSettings = {
  profile: {
    name: string;
    address: string;
    timezone: string;
    language: string;
  };
  notifications: {
    criticalIncidents: boolean;
    cameraOffline: boolean;
    dailyReport: boolean;
    serviceUpdates: boolean;
  };
  storage: {
    ordinaryRetentionDays: number;
    confirmedRetentionDays: number;
    automaticCleanup: boolean;
  };
  updatedAt: string;
};

export type ProductDatabase = {
  version: 1;
  cameras: Camera[];
  incidents: Incident[];
  posEvents: PosEvent[];
  settings: WorkspaceSettings;
  cameraConfigs?: CameraConfig[];
  stores?: Store[];
  terminals?: Terminal[];
};

export type EventAnalytics = {
  total: number;
  confirmed: number;
  falsePositive: number;
  pending: number;
  withClips: number;
  highRisk: number;
  meanReviewSeconds: number | null;
};
