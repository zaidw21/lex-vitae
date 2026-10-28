import type { VerticalPack } from "../types";

export const legalPack: VerticalPack = {
  id: "LEGAL",
  name: "Law practice",
  tagline: "Matters, hearing diary, client updates and fees for advocates",
  terms: {
    practice: "Chamber",
    contact: "Client",
    contacts: "Clients",
    practitioner: "Advocate",
    encounter: "Hearing",
    encounters: "Hearings",
  },
  practitionerPrefix: "Adv.",
  modules: ["dashboard", "hearings", "matters", "contacts", "appointments", "billing", "tasks", "messages", "settings"],
  contactFields: [
    { key: "occupation", label: "Occupation", type: "text" },
    { key: "referredBy", label: "Referred by", type: "text" },
  ],
  defaultServices: [
    { name: "Consultation", price: 2000 },
    { name: "Appearance fee (per hearing)", price: 3000 },
    { name: "Drafting: legal notice", price: 5000 },
    { name: "Drafting: petition / application", price: 10000 },
    { name: "Court fee & expenses", price: 0 },
  ],
  defaultSettings: {},
  messages: {
    APPOINTMENT_BOOKED: {
      en: "Namaste {{name}}, your meeting at {{org}} is confirmed for {{when}}. Address: {{address}}",
      hi: "नमस्ते {{name}}, {{org}} में आपकी मुलाक़ात {{when}} के लिए तय है। पता: {{address}}",
    },
    HEARING_UPDATE: {
      en: "{{org}}: Update on your case {{matter}}. Today: {{outcome}}. Next date of hearing: {{next}}.",
      hi: "{{org}}: आपके केस {{matter}} की जानकारी। आज: {{outcome}}। अगली सुनवाई की तारीख: {{next}}।",
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
      en: "{{org}}: Received {{amount}} from {{name}} towards professional fees. Receipt: {{link}}. Thank you.",
      hi: "{{org}}: {{name}} से पेशेवर फीस के रूप में {{amount}} प्राप्त हुए। रसीद: {{link}}। धन्यवाद।",
    },
  },
};

export const CASE_TYPES = [
  "Civil suit",
  "Criminal case",
  "Bail application",
  "Writ petition",
  "Family / matrimonial",
  "Cheque bounce (NI Act 138)",
  "Consumer complaint",
  "Motor accident claim",
  "Property / revenue",
  "Arbitration",
  "Other",
];

export const MATTER_STAGES = [
  "Filing",
  "Notice / service",
  "Appearance",
  "Written statement / reply",
  "Framing of issues / charges",
  "Evidence",
  "Arguments",
  "Judgment reserved",
  "Disposed",
];
