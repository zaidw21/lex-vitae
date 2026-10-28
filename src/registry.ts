// Composition root: the apps this deployment runs. Adding an app = one import + one entry here
// (plus its thin route files under src/app). The platform reads apps only through this registry.
import { clinicApp } from "@/apps/clinic/app";
import { legalApp } from "@/apps/legal/app";
import type { AppManifest } from "@/platform/kernel/types";

export const APPS: Record<string, AppManifest> = {
  [clinicApp.id]: clinicApp,
  [legalApp.id]: legalApp,
};

export function appFor(id: string): AppManifest {
  const app = APPS[id];
  if (!app) throw new Error(`Unknown app "${id}". Is it registered in src/registry.ts?`);
  return app;
}
