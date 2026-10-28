import { config } from "@/platform/kernel/config";

export function appUrl(path: string): string {
  const base = config().APP_URL.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
