export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const accessTokenKey = "secureguard.access-token";

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(accessTokenKey, token);
  else window.localStorage.removeItem(accessTokenKey);
  window.dispatchEvent(new Event("secureguard:session-changed"));
}

export function getAccessToken(): string | null {
  return typeof window === "undefined" ? null : (
      window.localStorage.getItem(accessTokenKey)
    );
}

export function apiUrl(path: string): string {
  const configuredBase = import.meta.env.VITE_API_URL?.trim();
  return (
    configuredBase ?
      new URL(path, `${configuredBase.replace(/\/$/, "")}/`).toString()
    : typeof window === "undefined" ? `http://localhost${path}`
    : new URL(path, window.location.origin).toString()
  );
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = apiUrl(path);
  const token = getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ?
        {}
      : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    // A delayed response from a previous login must not invalidate a newer session.
    if (response.status === 401 && token && getAccessToken() === token)
      setAccessToken(null);
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      detail?: unknown;
    } | null;
    const validation =
      Array.isArray(body?.detail) ?
        body.detail
          .map(
            (item: { loc?: unknown[]; msg?: string }) =>
              `${item.loc?.filter((part) => part !== "body").join(".") ?? "Поле"}: ${item.msg ?? "проверьте значение"}`,
          )
          .join("; ")
      : null;
    const message =
      body?.message ??
      (typeof body?.detail === "string" ?
        body.detail
      : validation || "Не удалось выполнить запрос");
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}
