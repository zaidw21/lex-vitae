import type { Vertical } from "@prisma/client";
import { clinicPack } from "./clinic";
import { legalPack } from "./legal";
import type { ModuleKey, VerticalPack } from "./types";

export const PACKS: Record<Vertical, VerticalPack> = {
  CLINIC: clinicPack,
  LEGAL: legalPack,
};

export function packFor(vertical: Vertical): VerticalPack {
  return PACKS[vertical];
}

export function hasModule(vertical: Vertical, module: ModuleKey): boolean {
  return PACKS[vertical].modules.includes(module);
}

export type { ModuleKey, VerticalPack } from "./types";
