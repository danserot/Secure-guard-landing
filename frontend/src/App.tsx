import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { DashboardPage } from "./DashboardPage";
import { apiRequest, getAccessToken, setAccessToken } from "./api/client";
import type { PageId } from "./productContent";
import { useCurrentUser } from "./api/queries";
import { PhoneCameraPage } from "./components/camera/PhoneCamera";

const rootRoute = createRootRoute({ component: Outlet });

const pageRoutes: Array<{ path: string; page: PageId }> = [
  { path: "/", page: "overview" },
  { path: "/cameras", page: "cameras" },
  { path: "/zones", page: "zones" },
  { path: "/incidents", page: "incidents" },
  { path: "/pos", page: "pos" },
  { path: "/analytics", page: "analytics" },
  { path: "/staff", page: "staff" },
  { path: "/settings", page: "settings" },
];

const routeTree = rootRoute.addChildren(
  pageRoutes.map(({ page, path }) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <DashboardPage activePage={page} />,
    }),
  ),
);

const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  if (window.location.pathname === "/phone-camera") return <PhoneCameraPage />;
  if (import.meta.env.VITE_USE_MOCK_API === "true") {
    return <RouterProvider router={router} />;
  }
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(getAccessToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncSession = (event: Event) => {
      if (
        event instanceof StorageEvent &&
        event.key &&
        event.key !== "secureguard.access-token"
      )
        return;
      void queryClient.cancelQueries();
      queryClient.clear();
      setToken(getAccessToken());
    };
    window.addEventListener("secureguard:session-changed", syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("secureguard:session-changed", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, [queryClient]);

  if (token) {
    return (
      <>
        <SessionDashboard />
        <button
          className="logout-button"
          type="button"
          onClick={() => {
            setAccessToken(null);
            setToken(null);
          }}>
          Выйти
        </button>
      </>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiRequest<{ accessToken: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      setAccessToken(result.accessToken);
      setToken(result.accessToken);
    } catch (requestError) {
      setError(
        requestError instanceof Error ?
          requestError.message
        : "Не удалось выполнить запрос.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="brand-mark">S</div>
        <p className="eyebrow">SECUREGUARD / RETAIL INTELLIGENCE</p>
        <h1>Контроль кассовой зоны без лишнего шума.</h1>
        <p className="hero-copy">
          Сохраняйте события с веб-камеры и проверяйте короткие клипы.
          Подключение к реальной кассе требует отдельной интеграции.
        </p>
        <div className="hero-stats">
          <span>
            <strong>Видео</strong> для проверки
          </span>
          <span>
            <strong>Человек</strong> принимает решение
          </span>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-header">
          <p className="eyebrow">WORKSPACE ACCESS</p>
          <h2 id="auth-title">С возвращением</h2>
          <p>
            Войдите в рабочее пространство. Учётную запись создаёт
            администратор.
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              required
              autoComplete="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Пароль
            <span className="password-field">
              <input
                required
                minLength={8}
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="Минимум 8 символов"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </span>
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? "Подождите..." : "Войти в систему"}
          </button>
        </form>
        <p className="auth-note">
          Доступ защищён JWT-аутентификацией. Не передавайте пароль другим
          пользователям.
        </p>
      </section>
    </main>
  );
}

function SessionDashboard() {
  const user = useCurrentUser();
  if (user.isPending)
    return (
      <main className="auth-shell">
        <p role="status">Проверяем доступ к рабочему пространству…</p>
      </main>
    );
  if (user.isError)
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p role="alert">Не удалось проверить доступ: {user.error.message}</p>
          <button type="button" onClick={() => void user.refetch()}>
            Повторить
          </button>
        </section>
      </main>
    );
  return <RouterProvider router={router} />;
}
