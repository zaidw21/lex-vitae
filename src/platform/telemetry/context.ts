import { AsyncLocalStorage } from "node:async_hooks";

/** Fields attached to every log line and error captured while handling one request or job. */
export interface TelemetryContext {
  requestId?: string;
  orgId?: string;
  userId?: string;
  app?: string;
  action?: string;
}

const storage = new AsyncLocalStorage<TelemetryContext>();

export function telemetryContext(): TelemetryContext {
  return storage.getStore() ?? {};
}

export function withTelemetryContext<T>(fields: TelemetryContext, fn: () => Promise<T>): Promise<T> {
  return storage.run({ ...telemetryContext(), ...fields }, fn);
}
