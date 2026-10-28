// Next.js calls this for every uncaught error while rendering a page or handling a request,
// so page errors are captured by the platform's error reporter like action errors are.
import type { Instrumentation } from "next";

export async function register() {}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureError } = await import("@/platform/telemetry/errors");
  captureError(error, { path: request.path, method: request.method, routePath: context.routePath, routeType: context.routeType });
};
