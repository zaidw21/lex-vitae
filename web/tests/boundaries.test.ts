import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Architecture rules for the web client, checked on every test run (the Java API has its own, in ArchUnit):
//  1. The platform UI never imports an app UI. It reaches apps only through the composition root (src/registry.ts).
//  2. An app UI never imports another app UI.
//  3. Apps don't import the registry.
//  4. The web client holds no business data access: no database drivers or ORMs; everything goes through the API.
//  5. Only the API client and the session cookie code read process.env.

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

interface Import {
  file: string;
  spec: string;
  target: string; // resolved path relative to src/ for local imports, else the package name
  typeOnly: boolean;
}

function importsOf(file: string): Import[] {
  const source = readFileSync(file, "utf8");
  const found: Import[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm;
  for (const m of source.matchAll(re)) {
    const spec = m[3];
    let target = spec;
    if (spec.startsWith("@/")) target = spec.slice(2);
    else if (spec.startsWith(".")) target = path.relative(SRC, path.resolve(path.dirname(file), spec));
    found.push({ file: path.relative(ROOT, file), spec, target, typeOnly: Boolean(m[2]) });
  }
  return found;
}

const all = files(SRC).flatMap(importsOf);
const appOf = (p: string) => /^src\/apps\/([^/]+)\//.exec(p)?.[1];

describe("architecture boundaries", () => {
  it("platform code never imports an app", () => {
    const bad = all.filter((i) => i.file.startsWith("src/platform/") && i.target.startsWith("apps/"));
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it("apps never import other apps", () => {
    const bad = all.filter((i) => {
      const from = appOf(i.file);
      const to = /^apps\/([^/]+)/.exec(i.target)?.[1];
      return from && to && from !== to;
    });
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it("apps don't import the registry", () => {
    const bad = all.filter((i) => appOf(i.file) && i.target === "registry");
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it("the web client never talks to a database directly", () => {
    const bad = all.filter((i) => /^(@prisma\/|prisma$|pg$|postgres$|drizzle-orm|kysely)/.test(i.spec));
    expect(bad.map((i) => `${i.file} → ${i.spec}`)).toEqual([]);
  });

  it("only the API client and session code read process.env", () => {
    const allowed = new Set(["src/platform/api/client.ts", "src/platform/kernel/auth.ts"]);
    const bad = files(SRC)
      .map((f) => path.relative(ROOT, f))
      .filter((f) => !allowed.has(f) && readFileSync(path.join(ROOT, f), "utf8").includes("process.env"));
    expect(bad).toEqual([]);
  });

  it("finds the code it is checking", () => {
    expect(all.filter((i) => i.file.startsWith("src/apps/")).length).toBeGreaterThan(20);
    expect(all.filter((i) => i.file.startsWith("src/platform/")).length).toBeGreaterThan(40);
  });
});
