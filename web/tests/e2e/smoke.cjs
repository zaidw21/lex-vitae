// End-to-end smoke test: drives every main flow in a real browser and saves screenshots.
// Needs a running app with fresh seed data (java -jar arcus-server.jar --spring.profiles.active=seed) and Playwright installed
// (npm i --no-save playwright && npx playwright install chromium). Run: npm run e2e
const { chromium } = require("playwright");
const SHOTS = require("node:path").join(process.env.SHOTS_DIR || require("node:path").join(require("node:os").tmpdir(), "arcus-shots"), "/");
require("node:fs").mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:3000";
const errors = [];
let failed = 0;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on("pageerror", (e) => errors.push("pageerror@" + page.url() + ": " + e.message.slice(0, 60)));
  page.on("console", (m) => m.type() === "error" && errors.push("console@" + page.url() + ": " + (m.location().url || "") + " " + m.text().slice(0, 50)));
  const step = async (name, fn) => {
    try { await fn(); console.log("✓", name); }
    catch (e) { failed++; console.log("✗", name, "-", e.message.split("\n")[0]); await page.screenshot({ path: SHOTS + "FAIL-" + name.replace(/\W+/g, "_") + ".png", fullPage: true }); }
  };
  const shot = (n) => page.screenshot({ path: SHOTS + n + ".png", fullPage: true });

  await step("landing", async () => { await page.goto(BASE); await page.getByText("Run your whole practice").waitFor(); await shot("01-landing"); });
  await step("login", async () => {
    await page.goto(BASE + "/login");
    await page.fill("#email", "demo@example.com"); await page.fill("#password", "demo1234");
    await page.click("button[type=submit]"); await page.waitForURL(BASE + "/app");
    await page.getByText("Patients today").waitFor(); await shot("02-dashboard");
  });
  await step("queue walk-in", async () => {
    await page.goto(BASE + "/app/queue");
    await page.fill("input[name=name]", "Test Patient"); await page.fill("input[name=phone]", "9876543210");
    await page.fill("input[name=age]", "34"); await page.selectOption("select[name=gender]", "F");
    await page.getByRole("button", { name: "Issue token" }).click();
    await page.getByText(/Token #\d+ issued to Test Patient/).waitFor(); await shot("03-queue");
  });
  await step("call next -> consult -> save Rx", async () => {
    // Finish the in-progress patient first by starting the walk-in directly
    const row = page.locator("tr", { hasText: "Test Patient" });
    await row.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/app\/consult\?entry=/);
    await page.fill("#bp", "130/85"); await page.fill("#complaints", "Fever and cough"); await page.fill("#diagnosis", "Viral URTI");
    await page.getByRole("button", { name: "+ Tab. Paracetamol 650" }).click();
    await page.fill("input[aria-label='Add medicine']", "Syp. Ambroxol"); await page.keyboard.press("Enter");
    await page.locator("label", { hasText: "1 wk" }).click();
    await page.locator("label", { hasText: /^\s*UPI\s*$/ }).click();
    await shot("04-consult");
    await page.getByRole("button", { name: "Save & print prescription" }).click();
    await page.waitForURL(/\/app\/documents\/.+\?saved=1/);
    await page.getByText("सुबह 1, दोपहर 1, रात 1").first().waitFor().catch(() => page.getByText("1 in the morning").first().waitFor());
    await shot("05-prescription");
  });
  await step("billing + daybook", async () => {
    await page.goto(BASE + "/app/billing"); await page.getByText("Collected today").waitFor(); await shot("06-billing");
    await page.goto(BASE + "/app/billing/new");
    await page.fill("input[aria-label=Name]", "Walk-in Buyer"); await page.fill("input[aria-label=Mobile]", "9123456780");
    await page.getByRole("button", { name: /\+ ECG/ }).click();
    await page.fill("#discount", "50"); await page.fill("#notes", "Senior citizen");
    await page.getByRole("button", { name: "Save bill" }).click();
    await page.waitForURL(/\/app\/billing\/[0-9a-f-]{36}$/); await page.getByText("Senior citizen").count();
    await shot("07-invoice");
    await page.fill("input[aria-label=Reason]", "Duplicate entry"); await page.getByRole("button", { name: "Void bill" }).click();
    await page.getByText("This bill was voided: Duplicate entry").waitFor();
    await page.goto(BASE + "/app/billing/daybook"); await page.getByText("was already collected").first().waitFor(); await shot("08-daybook");
  });
  await step("follow-ups", async () => {
    await page.goto(BASE + "/app/tasks"); await page.getByRole("button", { name: /Remind everyone due tomorrow/ }).click();
    await page.getByText(/Sent \d+ reminder/).waitFor(); await shot("09-tasks");
  });
  await step("messages", async () => { await page.goto(BASE + "/app/messages"); await page.getByText("Test mode").waitFor(); await shot("10-messages"); });
  await step("appointments + check-in", async () => {
    await page.goto(BASE + "/app/appointments"); await page.getByText("Book appointment").first().waitFor();
    const btn = page.getByRole("button", { name: "Check in" }).first();
    if (await btn.count()) { await btn.click(); await page.waitForURL(BASE + "/app/queue"); }
    await page.goto(BASE + "/app/appointments"); await shot("11-appointments");
  });
  await step("patient profile", async () => {
    await page.goto(BASE + "/app/contacts?q=Test"); await page.getByRole("link", { name: "Test Patient" }).click();
    await page.getByText("Viral URTI").first().waitFor(); await shot("12-patient");
  });
  await step("settings + audit", async () => {
    await page.goto(BASE + "/app/settings"); await page.getByText("Favourite medicines").waitFor(); await shot("13-settings");
    await page.goto(BASE + "/app/audit"); await page.getByText("invoice voided").first().waitFor();
  });
  await step("TV display", async () => { await page.goto(BASE + "/display/sharma-family-clinic-indore"); await page.getByText("Now serving").waitFor(); await shot("14-display"); });
  await step("token status page", async () => {
    const res = await page.request.get(BASE + "/app/messages");
    const html = await res.text();
    const m = html.match(/\/t\/([a-z0-9]{10})/);
    if (!m) throw new Error("no token link in outbox");
    await page.goto(BASE + "/t/" + m[1]); await page.getByText(/token|टोकन/i).first().waitFor(); await shot("15-token-status");
  });
  await step("switch to legal + diary", async () => {
    await page.goto(BASE + "/app");
    await page.selectOption("select[name=orgId]", { label: "Verma & Associates" }); await page.getByRole("button", { name: "Go" }).click();
    await page.getByText("Hearings today").first().waitFor(); await shot("16-legal-dashboard");
    await page.goto(BASE + "/app/hearings"); await page.getByText("Needs a date").waitFor(); await shot("17-hearings");
    await page.getByRole("link", { name: "Record outcome" }).first().click();
    await page.fill("#purpose", "Evidence"); await page.fill("#outcome", "PW-1 examined; next date for cross.");
    await page.getByRole("button", { name: "Save hearing" }).click(); await page.getByText("Hearing recorded").waitFor();
    await shot("18-matter");
    const q = await page.request.get(BASE + "/app/queue"); if (q.status() !== 404) throw new Error("queue should 404 for legal, got " + q.status());
  });
  await step("signup new org", async () => {
    const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage();
    await p2.goto(BASE + "/signup");
    await p2.check("input[value=clinic]"); await p2.fill("#orgName", "Gupta Child Care"); await p2.fill("#city", "Bhopal");
    await p2.fill("#name", "Dr. Ritu Gupta"); await p2.fill("#phone", "9988776655");
    await p2.fill("#email", `ritu${Date.now()}@example.com`); await p2.fill("#password", "password123");
    await p2.click("button[type=submit]"); await p2.waitForURL(BASE + "/app"); await p2.getByText("Patients today").waitFor();
    // tenant isolation: the new clinic must not see demo patients
    await p2.goto(BASE + "/app/contacts?q=Test"); await p2.getByText(/No patients match/).waitFor();
    await ctx2.close();
  });
  await step("mobile queue", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/app"); await page.selectOption("select[name=orgId]", { label: "Sharma Family Clinic" }); await page.getByRole("button", { name: "Go" }).click();
    await page.getByText("Patients today").waitFor();
    await page.goto(BASE + "/app/queue"); await shot("19-mobile-queue");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error("page scrolls horizontally by " + overflow + "px");
  });
  console.log("errors:", errors.length ? errors : "none");
  console.log("screenshots:", SHOTS);
  if (errors.length || failed) process.exitCode = 1;
  await browser.close();
})();
