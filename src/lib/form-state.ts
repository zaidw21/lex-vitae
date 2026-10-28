import { unstable_rethrow } from "next/navigation";

export type FormState = { error?: string; ok?: string } | null;

/** Turn a thrown error into a form error, letting Next.js redirects/notFound pass through. */
export function fail(err: unknown): FormState {
  unstable_rethrow(err);
  console.error(err);
  const internal = !(err instanceof Error) || err.constructor.name.startsWith("PrismaClient");
  return { error: internal ? "Something went wrong. Please try again." : (err as Error).message };
}
