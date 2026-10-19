import type {
  CreatePosEventInput,
  CreatePosEventResult,
  Camera,
  Incident,
  IncidentPatch,
  PosEvent,
  WorkspaceSettings,
  IncidentFilters,
  CameraConfig,
  Store,
  Terminal,
  CurrentUser,
} from "../domain/models";
import { apiRequest } from "./client";

export interface IncidentRepository {
  list(filters?: IncidentFilters, signal?: AbortSignal): Promise<Incident[]>;
  get(id: string, signal?: AbortSignal): Promise<Incident>;
  update(id: string, patch: IncidentPatch): Promise<Incident>;
}

export interface CameraRepository {
  list(signal?: AbortSignal): Promise<Camera[]>;
}

export interface PosEventRepository {
  list(
    page?: { limit: number; offset: number },
    signal?: AbortSignal,
  ): Promise<PosEvent[]>;
  create(input: CreatePosEventInput): Promise<CreatePosEventResult>;
  retry(id: string): Promise<PosEvent>;
  synchronize(): Promise<PosEvent[]>;
}

export interface SettingsRepository {
  get(signal?: AbortSignal): Promise<WorkspaceSettings>;
  update(settings: WorkspaceSettings): Promise<WorkspaceSettings>;
}

export const incidentRepository: IncidentRepository = {
  list: (filters = {}, signal) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiRequest<Incident[]>(
      `/api/incidents${params.size ? `?${params}` : ""}`,
      { signal },
    );
  },
  get: (id, signal) =>
    apiRequest<Incident>(`/api/incidents/${encodeURIComponent(id)}`, {
      signal,
    }),
  update: (id, patch) =>
    apiRequest<Incident>(`/api/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

export const cameraConfigRepository = {
  list: (signal?: AbortSignal) =>
    apiRequest<CameraConfig[]>("/api/v1/cameras", { signal }),
  save: (config: CameraConfig) => {
    const payload = { ...config };
    delete payload.health;
    return apiRequest<CameraConfig>(
      `/api/v1/cameras/${encodeURIComponent(config.camera_id)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
  },
};

export const workspaceRepository = {
  me: (signal?: AbortSignal) =>
    apiRequest<CurrentUser>("/api/auth/me", { signal }),
  stores: (signal?: AbortSignal) =>
    apiRequest<Store[]>("/api/v1/stores", { signal }),
  terminals: (signal?: AbortSignal) =>
    apiRequest<Terminal[]>("/api/v1/terminals", { signal }),
  createStore: (store: Store) =>
    apiRequest<Store>("/api/v1/stores", {
      method: "POST",
      body: JSON.stringify(store),
    }),
  createTerminal: (terminal: Terminal) =>
    apiRequest<Terminal>("/api/v1/terminals", {
      method: "POST",
      body: JSON.stringify(terminal),
    }),
};

export const cameraRepository: CameraRepository = {
  list: (signal) => apiRequest<Camera[]>("/api/cameras", { signal }),
};

export const posEventRepository: PosEventRepository = {
  list: (page, signal) =>
    apiRequest<PosEvent[]>(
      `/api/pos-events${page ? `?limit=${page.limit}&offset=${page.offset}` : ""}`,
      { signal },
    ),
  create: (input) =>
    apiRequest<CreatePosEventResult>("/api/pos-events", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  retry: (id) =>
    apiRequest<PosEvent>(`/api/pos-events/${id}/retry`, { method: "POST" }),
  synchronize: () =>
    apiRequest<PosEvent[]>("/api/pos-events/synchronize", { method: "POST" }),
};

export const settingsRepository: SettingsRepository = {
  get: (signal) => apiRequest<WorkspaceSettings>("/api/settings", { signal }),
  update: (settings) =>
    apiRequest<WorkspaceSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};
