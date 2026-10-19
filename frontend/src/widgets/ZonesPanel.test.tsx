import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { readDatabase } from "../data/localDatabase";
import { server } from "../mocks/server";
import { ZonesPanel } from "./ZonesPanel";

it("rejects degenerate polygons and keeps a valid draft for retry until persisted", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const user = userEvent.setup();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={client}>
        <ZonesPanel />
      </QueryClientProvider>
    </ChakraProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Источник для разметки")).toHaveValue("D01"),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Начать по точкам" }),
    ).toBeEnabled(),
  );
  const canvas = screen.getByTestId("zone-canvas");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 562.5,
    width: 1000,
    height: 562.5,
    toJSON: () => ({}),
  });
  await user.click(screen.getByRole("button", { name: "Начать по точкам" }));
  [100, 300, 500].forEach((x) =>
    fireEvent.pointerDown(canvas, { button: 0, clientX: x, clientY: 100 }),
  );
  await user.click(screen.getByRole("button", { name: "Завершить · 3 точек" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("не прямую линию");
  expect(screen.getByRole("button", { name: "Сохранить зоны" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Назад" }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: 500, clientY: 400 });
  await user.click(screen.getByRole("button", { name: "Завершить · 3 точек" }));
  server.use(
    http.put(
      "*/api/v1/cameras/D01",
      () =>
        HttpResponse.json(
          { detail: "Повторите сохранение зон" },
          { status: 503 },
        ),
      { once: true },
    ),
  );
  await user.click(screen.getByRole("button", { name: "Сохранить зоны" }));
  await screen.findByText("Повторите сохранение зон");
  expect(screen.getByText("Есть несохранённые изменения")).toBeInTheDocument();
  expect(readDatabase().cameraConfigs).toBeUndefined();
  await user.click(screen.getByRole("button", { name: "Сохранить зоны" }));
  await screen.findByText("Зоны сохранены на сервере");
  expect(
    readDatabase().cameraConfigs?.find((camera) => camera.camera_id === "D01")
      ?.zones,
  ).toEqual([
    expect.objectContaining({
      type: "cashier_zone",
      points: [
        [0.1, 100 / 562.5],
        [0.3, 100 / 562.5],
        [0.5, 400 / 562.5],
      ],
    }),
  ]);
  vi.unstubAllGlobals();
});
