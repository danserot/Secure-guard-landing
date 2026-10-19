import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { setAccessToken } from "../api/client";
import { server } from "../mocks/server";
import { EvidenceVideo } from "./EvidenceVideo";

afterEach(() => {
  setAccessToken(null);
  vi.restoreAllMocks();
});

it("loads a signed redirect without forwarding the bearer token to object storage", async () => {
  setAccessToken("evidence-test-token");
  let signedHeaders: Headers | undefined;
  server.use(
    http.get("*/api/incidents/signed/clip", ({ request }) => {
      expect(request.headers.get("authorization")).toBe(
        "Bearer evidence-test-token",
      );
      return new HttpResponse(null, {
        status: 307,
        headers: {
          Location:
            "https://storage.example.test/evidence/clip.mp4?signature=test",
        },
      });
    }),
    http.get(
      "https://storage.example.test/evidence/clip.mp4",
      ({ request }) => {
        signedHeaders = request.headers;
        return new HttpResponse(new Uint8Array([0, 1, 2]), {
          headers: { "Content-Type": "video/mp4" },
        });
      },
    ),
  );
  const createUrl = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:protected-clip");
  const revokeUrl = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  const { container, unmount } = render(
    <ChakraProvider value={defaultSystem}>
      <EvidenceVideo path="/api/incidents/signed/clip" />
    </ChakraProvider>,
  );
  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "blob:protected-clip",
    ),
  );
  expect(createUrl).toHaveBeenCalledOnce();
  expect(signedHeaders?.get("authorization")).toBeNull();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  unmount();
  expect(revokeUrl).toHaveBeenCalledWith("blob:protected-clip");
});

it("streams a canonical S3 clip directly and refreshes an expired signed URL", async () => {
  setAccessToken("evidence-test-token");
  let requestCount = 0;
  server.use(
    http.get("*/api/v1/events/risk-event/clip-url", ({ request }) => {
      expect(request.headers.get("authorization")).toBe(
        "Bearer evidence-test-token",
      );
      requestCount += 1;
      return HttpResponse.json({
        url: `https://storage.example.test/clip.mp4?signature=${requestCount}`,
        expires_in: 60,
      });
    }),
  );
  const createBlob = vi.spyOn(URL, "createObjectURL");
  const { container } = render(
    <ChakraProvider value={defaultSystem}>
      <EvidenceVideo
        path="/api/incidents/risk-event/clip"
        eventId="risk-event"
      />
    </ChakraProvider>,
  );
  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://storage.example.test/clip.mp4?signature=1",
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем видео");
  fireEvent.loadedData(container.querySelector("video")!);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Клип доступен для проверки",
  );
  expect(createBlob).not.toHaveBeenCalled();
  fireEvent.error(container.querySelector("video")!);
  expect(
    screen.queryByText("Клип доступен для проверки"),
  ).not.toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Обновить ссылку и повторить" }),
  );
  await waitFor(() =>
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://storage.example.test/clip.mp4?signature=2",
    ),
  );
});
