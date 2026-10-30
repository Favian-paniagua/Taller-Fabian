/** Cliente de la API: envía y recibe JSON con la cookie de sesión. Los montos viajan en centavos. */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor del taller. Revisa que la PC esté encendida y el WiFi conectado.");
  }
  const data = r.headers.get("content-type")?.includes("json") ? await r.json() : null;
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
    throw new ApiError(r.status, data?.error || "Ocurrió un error inesperado.");
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b: unknown = {}) => request<T>("POST", p, b),
  patch: <T>(p: string, b: unknown) => request<T>("PATCH", p, b),
  put: <T>(p: string, b: unknown) => request<T>("PUT", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};
