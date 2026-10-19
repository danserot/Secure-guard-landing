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
import { describe, expect, it } from "vitest";
import { readDatabase } from "../data/localDatabase";
import { IncidentsPanel } from "./IncidentsPanel";

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={client}>
        <IncidentsPanel />
      </QueryClientProvider>
    </ChakraProvider>,
  );
}

describe("incident review flow", () => {
  it("records the operator decision through the repository", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click((await screen.findAllByText("Товар без сканирования"))[0]);
    const dialog = await screen.findByRole("dialog", {
      name: "Проверка инцидента",
    });
    fireEvent.change(within(dialog).getByLabelText("Комментарий к решению"), {
      target: { value: "На клипе видно передачу товара без сканирования" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: /Подтвердить/ }),
    );

    await waitFor(() =>
      expect(
        readDatabase().incidents.find((item) => item.id === "INC-2048")?.status,
      ).toBe("confirmed"),
    );
  });

  it("shows missing video honestly and saves an unsure review", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click((await screen.findAllByText("Товар без сканирования"))[0]);
    const dialog = await screen.findByRole("dialog", {
      name: "Проверка инцидента",
    });
    expect(
      within(dialog).getByText("Видеоклип пока недоступен"),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Воспроизвести" }),
    ).not.toBeInTheDocument();
    expect(
      await within(dialog).findByText("POS-события рядом по времени"),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Комментарий к решению"), {
      target: { value: "Рука закрывает товар, данных недостаточно" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Не уверен" }));
    await waitFor(() =>
      expect(
        readDatabase().incidents.find((item) => item.id === "INC-2048")?.status,
      ).toBe("unsure"),
    );
  });

  it("replaces results when server filters change", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findAllByText("Товар без сканирования");
    await user.click(
      screen.getByRole("button", { name: "Дополнительные фильтры" }),
    );
    fireEvent.change(screen.getByLabelText("Начало периода"), {
      target: { value: "2099-01-01T00:00" },
    });
    await screen.findByText("Инциденты не найдены");
    expect(
      screen.queryByText("Товар без сканирования"),
    ).not.toBeInTheDocument();
  });
});
