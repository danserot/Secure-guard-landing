import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { expect, it } from "vitest";
import { server } from "../mocks/server";
import { useIncidents } from "./queries";

it("does not display cached demo incidents after the runtime switches to real mode", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["runtime"], {
    demoMode: true,
    dataSource: "postgresql",
    posIntegration: "demo",
  });
  const { result } = renderHook(() => useIncidents(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
  server.use(http.get("*/api/incidents", () => HttpResponse.json([])));
  act(() =>
    client.setQueryData(["runtime"], {
      demoMode: false,
      dataSource: "postgresql",
      posIntegration: "not_configured",
    }),
  );
  await waitFor(() => expect(result.current.data).toEqual([]));
  expect(client.getQueryData(["incidents", "postgresql:demo"])).not.toEqual([]);
});

it("aborts an old HTTP request when incident filters change and on unmount", async () => {
  const requests: Request[] = [];
  server.use(
    http.get("*/api/incidents", async ({ request }) => {
      requests.push(request);
      await new Promise<void>((resolve) =>
        request.signal.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
      return HttpResponse.json([]);
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["runtime"], {
    demoMode: false,
    dataSource: "postgresql",
    posIntegration: "not_configured",
  });
  const { rerender, unmount } = renderHook(
    ({ camera }) => useIncidents({ camera_id: camera }),
    {
      initialProps: { camera: "D01" },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await waitFor(() => expect(requests).toHaveLength(1));
  rerender({ camera: "D02" });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].signal.aborted).toBe(true);
  expect(requests[1].signal.aborted).toBe(false);
  unmount();
  expect(requests[1].signal.aborted).toBe(true);
  client.clear();
});
