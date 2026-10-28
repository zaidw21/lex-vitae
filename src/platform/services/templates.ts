import type { Lang, MessageTemplates } from "@/platform/kernel/types";

/** Generic wording for platform messages. Apps and modules override any key with their own wording. */
export const PLATFORM_MESSAGES: MessageTemplates = {
  APPOINTMENT_BOOKED: {
    en: "Namaste {{name}}, your appointment at {{org}} is confirmed for {{when}}. Address: {{address}}",
    hi: "नमस्ते {{name}}, {{org}} में आपका अपॉइंटमेंट {{when}} के लिए पक्का है। पता: {{address}}",
  },
  FOLLOW_UP_REMINDER: {
    en: "Namaste {{name}}, a reminder from {{org}}: {{title}} is due on {{date}}.",
    hi: "नमस्ते {{name}}, {{org}} की ओर से याद दिलाना: {{title}} की तारीख {{date}} है।",
  },
  DOCUMENT_SHARED: {
    en: "{{name}}, a document from {{org}} has been shared with you: {{link}}",
    hi: "{{name}}, {{org}} ने आपके साथ एक दस्तावेज़ साझा किया है: {{link}}",
  },
  RECEIPT: {
    en: "{{org}}: Received {{amount}} from {{name}}. Receipt: {{link}}. Thank you.",
    hi: "{{org}}: {{name}} से {{amount}} प्राप्त हुए। रसीद: {{link}}। धन्यवाद।",
  },
};

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (key in vars ? String(vars[key]) : ""));
}

/** Render `key` from the first source that defines it (app, then modules, then platform defaults). */
export function messageText(
  sources: (MessageTemplates | undefined)[],
  key: string,
  lang: string,
  vars: Record<string, string | number>,
): string | null {
  const tpl = sources.find((s) => s?.[key])?.[key];
  if (!tpl) return null;
  const l: Lang = lang === "hi" ? "hi" : "en";
  return renderTemplate(tpl[l], vars);
}
