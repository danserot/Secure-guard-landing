import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

async function enableMockApi() {
  if (import.meta.env.VITE_USE_MOCK_API !== "true") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}

const rootElement = document.getElementById("root")!;
rootElement.textContent = "Подготавливаем приложение…";

try {
  if (/^\/landing\/?$/.test(window.location.pathname)) {
    const { default: LandingPage } = await import("./landing/LandingPage");
    rootElement.replaceChildren();
    createRoot(rootElement).render(<StrictMode><LandingPage /></StrictMode>);
  } else {
    const [{ default: App }, { AppProviders }] = await Promise.all([
      import("./App"),
      import("./AppProviders"),
      import("./index.css"),
    ]);
    await enableMockApi();
    rootElement.replaceChildren();
    createRoot(rootElement).render(
      <StrictMode><AppProviders><App /></AppProviders></StrictMode>,
    );
  }
} catch (error) {
  console.error("Не удалось запустить приложение", error);
  rootElement.textContent =
    "Не удалось запустить приложение. Перезагрузите страницу.";
}
