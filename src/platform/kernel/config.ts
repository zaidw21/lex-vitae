import { z } from "zod";

// All runtime configuration, read and validated in one place. Nothing else reads process.env.
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Where captured errors go: "log" writes Google Cloud Error Reporting-compatible JSON to stdout.
  ERROR_REPORTER: z.enum(["log"]).default("log"),
  // WhatsApp provider: "log" records messages without sending; "meta" uses the WhatsApp Cloud API.
  WHATSAPP_PROVIDER: z.enum(["log", "meta"]).default("log"),
  META_WA_TOKEN: z.string().optional(),
  META_WA_PHONE_NUMBER_ID: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function config(): Config {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid configuration: ${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}
