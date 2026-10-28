import type { VerticalPack } from "../types";

export const clinicPack: VerticalPack = {
  id: "CLINIC",
  name: "Clinic",
  tagline: "OPD queue, prescriptions, billing and follow-ups for clinics",
  terms: {
    practice: "Clinic",
    contact: "Patient",
    contacts: "Patients",
    practitioner: "Doctor",
    encounter: "Consultation",
    encounters: "Consultations",
  },
  practitionerPrefix: "Dr.",
  modules: ["dashboard", "queue", "appointments", "contacts", "billing", "tasks", "messages", "settings"],
  contactFields: [
    { key: "bloodGroup", label: "Blood group", type: "select", options: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    { key: "allergies", label: "Allergies", type: "text", placeholder: "e.g. Penicillin, sulfa" },
    { key: "conditions", label: "Chronic conditions", type: "text", placeholder: "e.g. Diabetes, hypertension" },
    { key: "guardian", label: "Guardian / relative", type: "text" },
  ],
  defaultServices: [
    { name: "Consultation", price: 400 },
    { name: "Follow-up consultation", price: 200 },
    { name: "Dressing", price: 150 },
    { name: "Injection (administration)", price: 100 },
    { name: "Nebulization", price: 200 },
    { name: "ECG", price: 300 },
  ],
  defaultSettings: { consultationFee: 400, followUpFee: 200, avgConsultMinutes: 8, followUpFreeDays: 7 },
  messages: {
    TOKEN_ISSUED: {
      en: "Namaste {{name}}, your token at {{org}} is #{{token}}. {{ahead}} patient(s) ahead of you. Track your turn live: {{link}}",
      hi: "नमस्ते {{name}}, {{org}} में आपका टोकन नंबर #{{token}} है। आपसे पहले {{ahead}} मरीज़ हैं। अपनी बारी यहाँ देखें: {{link}}",
    },
    TURN_NEAR: {
      en: "{{name}}, your turn at {{org}} is coming up (token #{{token}}). Please be near the cabin.",
      hi: "{{name}}, {{org}} में आपकी बारी आने वाली है (टोकन #{{token}})। कृपया केबिन के पास रहें।",
    },
    DELAY_NOTICE: {
      en: "{{org}}: The doctor is running about {{minutes}} minutes late today. Sorry for the wait. Live status: {{link}}",
      hi: "{{org}}: आज डॉक्टर लगभग {{minutes}} मिनट देरी से हैं। असुविधा के लिए खेद है। लाइव स्थिति: {{link}}",
    },
    APPOINTMENT_BOOKED: {
      en: "Namaste {{name}}, your appointment at {{org}} is confirmed for {{when}}. Address: {{address}}",
      hi: "नमस्ते {{name}}, {{org}} में आपका अपॉइंटमेंट {{when}} के लिए पक्का है। पता: {{address}}",
    },
    FOLLOW_UP_REMINDER: {
      en: "Namaste {{name}}, this is a reminder from {{org}} that your follow-up visit is due on {{date}}. Reply to book a time.",
      hi: "नमस्ते {{name}}, {{org}} की ओर से याद दिलाना है कि आपकी फॉलो-अप जाँच {{date}} को है। समय बुक करने के लिए जवाब दें।",
    },
    DOCUMENT_SHARED: {
      en: "{{name}}, your prescription from {{org}} is ready: {{link}}. Get well soon!",
      hi: "{{name}}, {{org}} से आपका पर्चा तैयार है: {{link}}। जल्दी स्वस्थ हों!",
    },
    RECEIPT: {
      en: "{{org}}: Received {{amount}} from {{name}}. Receipt: {{link}}. Thank you.",
      hi: "{{org}}: {{name}} से {{amount}} प्राप्त हुए। रसीद: {{link}}। धन्यवाद।",
    },
  },
};
