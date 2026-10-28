import { config } from "@/platform/kernel/config";
import { telemetryContext } from "./context";

// Structured JSON logs on stdout. Google Cloud Logging (and most log collectors) parse these lines,
// using `severity` for the level. Every line carries the request/org/user/app context automatically.

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SEVERITY: Record<Level, string> = { debug: "DEBUG", info: "INFO", warn: "WARNING", error: "ERROR" };

export type LogFields = Record<string, unknown>;

function write(level: Level, message: string, fields?: LogFields) {
  let minimum: Level = "info";
  try {
    minimum = config().LOG_LEVEL;
  } catch {
    // Logging must keep working even when configuration is broken.
  }
  if (ORDER[level] < ORDER[minimum]) return;
  const line = JSON.stringify({ severity: SEVERITY[level], time: new Date().toISOString(), message, ...telemetryContext(), ...fields });
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const log = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
