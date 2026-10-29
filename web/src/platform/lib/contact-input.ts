import { optStr, str } from "./form";

/** The contact form (create, edit, walk-in, quick booking) as the API's ContactInput. */
export function contactInput(form: FormData) {
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("f_") && typeof value === "string" && value.trim()) fields[key.slice(2)] = value.trim();
  }
  const age = Number.parseInt(str(form, "age"), 10);
  return {
    name: str(form, "name"),
    phone: str(form, "phone"),
    email: optStr(form, "email"),
    gender: optStr(form, "gender"),
    dob: optStr(form, "dob"),
    age: Number.isFinite(age) ? age : null,
    address: optStr(form, "address"),
    preferredLang: str(form, "preferredLang") === "hi" ? "hi" : "en",
    whatsappOptIn: form.get("whatsappOptIn") === "on",
    fields,
  };
}
