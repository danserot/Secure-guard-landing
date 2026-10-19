import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./client";

export type RuntimeConfig = {
  demoMode: boolean;
  dataSource: "postgresql" | "browser";
  posIntegration: "demo" | "not_configured" | "rest_adapter";
  matchingWindowSeconds?: number;
  riskThreshold?: number;
};

export const useMockApi = import.meta.env.VITE_USE_MOCK_API === "true";

export function useRuntimeConfig() {
  return useQuery({
    queryKey: ["runtime"],
    queryFn: ({ signal }) =>
      apiRequest<RuntimeConfig>("/api/runtime", { signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
