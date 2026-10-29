import "server-only";
import { cookies } from "next/headers";

// The only place the web app talks to the backend. Every call forwards the user's session token.

export const SESSION_COOKIE = "arcus_session";

/** Base URL of the Java API (the only setting the web app needs besides the session cookie). */
const API_URL = (process.env.API_URL || "http://localhost:8080").replace(/\/+$/, "");

/** An error returned by the API. `message` is safe to show to the user for 4xx responses. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function token(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

async function request<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const t = await token();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new ApiError(503, "The server is not reachable. Please try again in a moment.");
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, typeof json.error === "string" ? json.error : `Request failed (${res.status})`);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  /** For public pages and sign-in: never sends the session token. */
  public: <T>(path: string, body?: unknown) => request<T>(body === undefined ? "GET" : "POST", path, body, { auth: false }),
};

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
