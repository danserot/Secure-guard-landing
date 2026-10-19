import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "../mocks/server";
import { PosEventsPanel } from "./PosEventsPanel";

function renderPanel() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }>
        <PosEventsPanel />
      </QueryClientProvider>
    </ChakraProvider>,
  );
}

it("hides demo operations when the server reports real mode", async () => {
  server.use(
    http.get("*/api/runtime", () =>
      HttpResponse.json({
        demoMode: false,
        dataSource: "postgresql",
        posIntegration: "not_configured",
      }),
    ),
  );
  renderPanel();
  await screen.findByText("POS-адаптер не настроен");
  expect(
    screen.queryByRole("button", { name: "Генератор событий" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Синхронизировать" }),
  ).not.toBeInTheDocument();
});

it("shows the generator only after an explicit demo response", async () => {
  renderPanel();
  expect(
    await screen.findByRole("button", { name: "Генератор событий" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Демонстрационный POS Gateway")).toBeInTheDocument();
});

it("reports the REST adapter without claiming a specific register is connected", async () => {
  server.use(
    http.get("*/api/runtime", () =>
      HttpResponse.json({
        demoMode: false,
        dataSource: "postgresql",
        posIntegration: "rest_adapter",
      }),
    ),
  );
  renderPanel();
  await screen.findByText(
    "Приём операций через POS-адаптер. Наличие API не подтверждает подключение конкретной кассы.",
  );
  expect(
    screen.queryByRole("button", { name: "Генератор событий" }),
  ).not.toBeInTheDocument();
});

it("fails closed when the runtime endpoint is unavailable", async () => {
  server.use(
    http.get("*/api/runtime", () => new HttpResponse(null, { status: 503 })),
  );
  renderPanel();
  await screen.findByText("Недоступно");
  expect(
    screen.queryByRole("button", { name: "Генератор событий" }),
  ).not.toBeInTheDocument();
});
