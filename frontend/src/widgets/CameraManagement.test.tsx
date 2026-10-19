import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { readDatabase } from "../data/localDatabase";
import { server } from "../mocks/server";
import { CameraManagement } from "./CameraManagement";

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={client}>
        <CameraManagement />
      </QueryClientProvider>
    </ChakraProvider>,
  );
}

it("rejects RTSP credentials locally and preserves changes across a failed save", async () => {
  const user = userEvent.setup();
  renderPanel();
  await user.click(
    (await screen.findAllByRole("button", { name: "Настроить" }))[0],
  );
  const dialog = screen.getByRole("dialog", { name: "Настройка IP-камеры" });
  fireEvent.change(within(dialog).getByLabelText("Название камеры"), {
    target: { value: "Новая касса" },
  });
  fireEvent.change(within(dialog).getByLabelText("Источник на агенте"), {
    target: { value: "rtsp://user:test-password@camera/video" },
  });
  await user.click(
    within(dialog).getByRole("button", { name: "Сохранить камеру" }),
  );
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Пароль камеры хранится на агенте",
  );
  expect(readDatabase().cameraConfigs).toBeUndefined();

  server.use(
    http.put(
      "*/api/v1/cameras/D01",
      () =>
        HttpResponse.json(
          { detail: "Сервер временно недоступен" },
          { status: 503 },
        ),
      { once: true },
    ),
  );
  fireEvent.change(within(dialog).getByLabelText("Источник на агенте"), {
    target: { value: "env:RTSP_D01" },
  });
  await user.click(
    within(dialog).getByRole("button", { name: "Сохранить камеру" }),
  );
  expect(
    await within(dialog).findByText("Сервер временно недоступен"),
  ).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Название камеры")).toHaveValue(
    "Новая касса",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Сохранить камеру" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    readDatabase().cameraConfigs?.find((camera) => camera.camera_id === "D01")
      ?.name,
  ).toBe("Новая касса");
});

it("does not offer camera configuration to read-only users", async () => {
  server.use(
    http.get("*/api/auth/me", () =>
      HttpResponse.json({
        id: "viewer",
        email: "viewer@example.test",
        role: "viewer",
        organizationId: "demo",
      }),
    ),
  );
  renderPanel();
  await screen.findByText("Касса 1");
  expect(
    screen.queryByRole("button", { name: "Настроить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Подключить IP-камеру" }),
  ).not.toBeInTheDocument();
});
