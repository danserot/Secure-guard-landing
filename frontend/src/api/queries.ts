import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CameraConfig,
  CreatePosEventInput,
  EventAnalytics,
  IncidentFilters,
  IncidentPatch,
  WorkspaceSettings,
} from "../domain/models";
import { apiRequest } from "./client";
import {
  cameraConfigRepository,
  cameraRepository,
  incidentRepository,
  posEventRepository,
  settingsRepository,
  workspaceRepository,
} from "./repositories";
import { useRuntimeConfig } from "./runtime";

export const queryKeys = {
  cameras: ["cameras"] as const,
  incidents: ["incidents"] as const,
  posEvents: ["pos-events"] as const,
  settings: ["settings"] as const,
  cameraConfigs: ["camera-configs"] as const,
  stores: ["stores"] as const,
  terminals: ["terminals"] as const,
};

function useModeQuery(base: readonly string[]) {
  const runtime = useRuntimeConfig();
  const mode =
    runtime.isSuccess ?
      `${runtime.data.dataSource}:${runtime.data.demoMode ? "demo" : "live"}`
    : "unknown";
  return { queryKey: [...base, mode], enabled: runtime.isSuccess };
}

export function useCameras() {
  const mode = useModeQuery(queryKeys.cameras);
  return useQuery({
    ...mode,
    queryFn: ({ signal }) => cameraRepository.list(signal),
  });
}

export function useIncidents(filters?: IncidentFilters) {
  const mode = useModeQuery(queryKeys.incidents);
  return useQuery({
    ...mode,
    queryKey: filters ? [...mode.queryKey, filters] : mode.queryKey,
    queryFn: ({ signal }) => incidentRepository.list(filters, signal),
    refetchInterval: 10000,
  });
}

export function useIncident(id: string | null) {
  const mode = useModeQuery(["incident", id ?? ""]);
  return useQuery({
    ...mode,
    enabled: mode.enabled && !!id,
    queryFn: ({ signal }) => incidentRepository.get(id!, signal),
    refetchInterval: 10000,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: ({ signal }) => workspaceRepository.me(signal),
    staleTime: 60000,
  });
}

export function useCameraConfigs() {
  const mode = useModeQuery(queryKeys.cameraConfigs);
  return useQuery({
    ...mode,
    queryFn: ({ signal }) => cameraConfigRepository.list(signal),
    refetchInterval: 10000,
  });
}

export function useSaveCameraConfig() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (config: CameraConfig) => cameraConfigRepository.save(config),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.cameraConfigs }),
        client.invalidateQueries({ queryKey: queryKeys.cameras }),
      ]),
  });
}

export function useStores() {
  const mode = useModeQuery(queryKeys.stores);
  return useQuery({
    ...mode,
    queryFn: ({ signal }) => workspaceRepository.stores(signal),
  });
}

export function useTerminals() {
  const mode = useModeQuery(queryKeys.terminals);
  return useQuery({
    ...mode,
    queryFn: ({ signal }) => workspaceRepository.terminals(signal),
  });
}

export function useEventAnalytics(days: number, cameraId = "") {
  const mode = useModeQuery(["event-analytics"]);
  return useQuery({
    ...mode,
    queryKey: [...mode.queryKey, days, cameraId],
    queryFn: ({ signal }) =>
      apiRequest<EventAnalytics>(
        `/api/v1/analytics?days=${days}${cameraId ? `&camera_id=${encodeURIComponent(cameraId)}` : ""}`,
        { signal },
      ),
    refetchInterval: 10000,
  });
}

export function useUpdateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IncidentPatch }) =>
      incidentRepository.update(id, patch),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.incidents }),
        queryClient.invalidateQueries({ queryKey: ["incident"] }),
        queryClient.invalidateQueries({ queryKey: ["event-analytics"] }),
      ]),
  });
}

export function usePosEvents(page?: { limit: number; offset: number }) {
  const mode = useModeQuery(queryKeys.posEvents);
  return useQuery({
    ...mode,
    queryKey: page ? [...mode.queryKey, page] : mode.queryKey,
    queryFn: ({ signal }) => posEventRepository.list(page, signal),
    refetchInterval: 10000,
  });
}

export function useCreatePosEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePosEventInput) =>
      posEventRepository.create(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.posEvents }),
        queryClient.invalidateQueries({ queryKey: queryKeys.incidents }),
      ]),
  });
}

export function useRetryPosEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: posEventRepository.retry,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.posEvents }),
  });
}

export function useSynchronizePosEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: posEventRepository.synchronize,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.posEvents }),
  });
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: ({ signal }) => settingsRepository.get(signal),
  });
}

export function useSaveWorkspaceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: WorkspaceSettings) =>
      settingsRepository.update(settings),
    onSuccess: (settings) =>
      queryClient.setQueryData(queryKeys.settings, settings),
  });
}
