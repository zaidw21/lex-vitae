import type { Lang, MessageKey, VerticalPack } from "@/verticals/types";

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (key in vars ? String(vars[key]) : ""));
}

export function messageText(
  pack: VerticalPack,
  key: MessageKey,
  lang: string,
  vars: Record<string, string | number>,
): string | null {
  const tpl = pack.messages[key];
  if (!tpl) return null;
  const l: Lang = lang === "hi" ? "hi" : "en";
  return renderTemplate(tpl[l], vars);
}
