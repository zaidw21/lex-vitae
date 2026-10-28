import { log, type LogFields } from "./logger";

/** Where captured errors are sent. Add an adapter here (e.g. Sentry) and select it in config. */
export interface ErrorReporter {
  capture(error: Error, fields: LogFields): void;
}

/**
 * Writes errors as structured log lines in the format Google Cloud Error Reporting picks up
 * automatically, so errors are grouped and alerted on without any extra service.
 */
const logReporter: ErrorReporter = {
  capture(error, fields) {
    log.error(error.message, {
      "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
      stack_trace: error.stack,
      errorName: error.name,
      ...fields,
    });
  },
};

const reporter: ErrorReporter = logReporter;

export function captureError(error: unknown, fields: LogFields = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  reporter.capture(err, fields);
}
