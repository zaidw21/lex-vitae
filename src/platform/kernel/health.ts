import { db } from "@/platform/lib/db";
import { captureError } from "@/platform/telemetry/errors";

export const dynamic = "force-dynamic";

/** Liveness + database check for load balancers, uptime monitors and deploy pipelines. */
export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch (err) {
    captureError(err, { check: "health" });
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
