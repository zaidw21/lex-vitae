package com.arcus.server;

import com.arcus.platform.auth.AuthService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Tx;
import com.arcus.platform.orgs.ProvisioningService;
import com.arcus.platform.support.Ids;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Json;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Demo data: one clinic and one law chamber, both owned by demo@example.com / demo1234, plus a front-desk
 * user. Dated relative to today. Re-running replaces the demo organizations. Run with the "seed" profile.
 */
@Component
@Profile("seed")
public class DemoSeed implements CommandLineRunner {

    private static final String[] FIRST_F = {"Sunita", "Priya", "Kavita", "Neha", "Pooja", "Anjali", "Rekha", "Meena", "Shweta", "Ritu", "Aarti", "Nazia", "Farah", "Simran", "Divya"};
    private static final String[] FIRST_M = {"Rajesh", "Amit", "Suresh", "Vikas", "Rahul", "Manoj", "Sanjay", "Arjun", "Imran", "Deepak", "Rohit", "Anil", "Harish", "Gurpreet", "Mohit"};
    private static final String[] LAST = {"Sharma", "Verma", "Jain", "Patel", "Gupta", "Yadav", "Malviya", "Chouhan", "Khan", "Agrawal", "Tiwari", "Dubey", "Rathore", "Soni", "Singh"};
    private static final String[] AREAS = {"Vijay Nagar", "Palasia", "Rajwada", "Bhawarkua", "Sudama Nagar", "MR 10", "Rau", "Annapurna"};

    private record Case(String complaints, String diagnosis, int[] meds, String advice) {
    }

    private static final Case[] CASES = {
            new Case("Fever x 3 days, body ache", "Acute viral fever", new int[]{0, 5}, "Plenty of fluids. CBC if fever persists beyond 3 days."),
            new Case("Acidity, burning in chest after meals", "GERD", new int[]{1}, "Avoid spicy food and late dinners."),
            new Case("Sneezing, running nose", "Allergic rhinitis", new int[]{2}, "Avoid dust; steam inhalation."),
            new Case("Sore throat, cough", "Acute pharyngitis", new int[]{3, 0, 5}, "Warm saline gargles."),
            new Case("Loose motions x 2 days", "Acute gastroenteritis", new int[]{6, 9}, "ORS after every loose stool. Light diet."),
            new Case("Routine sugar check", "Type 2 diabetes mellitus, follow-up", new int[]{7}, "Walk 30 min daily. FBS/PPBS next visit."),
            new Case("Headache, BP check", "Essential hypertension", new int[]{8}, "Low salt diet. Monitor BP at home."),
    };

    private final JdbcClient db;
    private final Tx tx;
    private final ProvisioningService provisioning;
    private final AppRegistry registry;
    private long seed = 42;

    public DemoSeed(JdbcClient db, Tx tx, ProvisioningService provisioning, AppRegistry registry) {
        this.db = db;
        this.tx = tx;
        this.provisioning = provisioning;
        this.registry = registry;
    }

    private double rand() {
        seed = (seed * 1103515245L + 12345L) % 2147483648L;
        return seed / 2147483648.0;
    }

    private int between(int a, int b) {
        return a + (int) Math.floor(rand() * (b - a + 1));
    }

    private <T> T pick(T[] xs) {
        return xs[(int) Math.floor(rand() * xs.length)];
    }

    private <T> T pick(List<T> xs) {
        return xs.get((int) Math.floor(rand() * xs.size()));
    }

    private record Person(String name, String phone, String gender) {
    }

    private Person person() {
        boolean female = rand() < 0.5;
        String name = pick(female ? FIRST_F : FIRST_M) + " " + pick(LAST);
        String phone = "+91" + pick(new String[]{"98", "97", "94", "88", "70", "62"}) + between(10_000_000, 99_999_999);
        return new Person(name, phone, female ? "F" : "M");
    }

    @Override
    public void run(String... args) {
        String password = AuthService.hashPassword("demo1234");
        UUID[] users = tx.system(() -> {
            db.sql("""
                    DELETE FROM organizations WHERE id IN (SELECT m.org_id FROM memberships m JOIN users u ON u.id = m.user_id
                    WHERE u.email IN ('demo@example.com', 'reception@example.com'))""").update();
            db.sql("DELETE FROM users WHERE email IN ('demo@example.com', 'reception@example.com')").update();
            UUID doctor = db.sql("INSERT INTO users (email, name, phone, password_hash) VALUES ('demo@example.com', 'Dr. Anil Sharma', '+919826012345', ?) RETURNING id")
                    .param(password).query(UUID.class).single();
            UUID reception = db.sql("INSERT INTO users (email, name, password_hash) VALUES ('reception@example.com', 'Kiran (Reception)', ?) RETURNING id")
                    .param(password).query(UUID.class).single();
            return new UUID[]{doctor, reception};
        });
        tx.system(() -> {
            seedClinic(users[0], users[1]);
            seedLegal(users[0]);
            return null;
        });
        System.out.println("Seeded. Log in with demo@example.com / demo1234 (owner) or reception@example.com / demo1234 (front desk).");
    }

    private void seedClinic(UUID doctorId, UUID receptionId) {
        UUID org = provisioning.provision(new ProvisioningService.NewOrg("Sharma Family Clinic", "Indore", "+917312345678", registry.app("clinic"), doctorId));
        db.sql("UPDATE organizations SET address = ?, settings = ?::jsonb WHERE id = ?")
                .params("12, Saket Nagar, Indore, MP 452018", Json.write(Map.of("consultationFee", 400, "followUpFee", 0, "followUpFreeDays", 7, "queueAvgMinutes", 7)), org)
                .update();
        UUID owner = db.sql("UPDATE memberships SET qualifications = 'MBBS, MD (General Medicine)', registration_no = 'MPMC-23871' WHERE org_id = ? AND user_id = ? RETURNING id")
                .params(org, doctorId).query(UUID.class).single();
        db.sql("INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'STAFF')").params(org, receptionId).update();
        List<Map<String, Object>> medicines = db.sql("SELECT name, data FROM catalog_items WHERE org_id = ? AND kind = 'MEDICINE' ORDER BY ctid").param(org)
                .query((rs, n) -> {
                    Map<String, Object> m = new LinkedHashMap<>(Json.map(rs.getString("data")));
                    m.put("name", rs.getString("name"));
                    return m;
                }).list();

        LocalDate today = Ist.today();
        OffsetDateTime now = Ist.now();
        record Patient(UUID id, String name, String phone, String lang) {
        }
        List<Patient> patients = new ArrayList<>();
        for (int i = 0; i < 70; i++) {
            Person p = person();
            int age = between(3, 78);
            String lang = rand() < 0.7 ? "hi" : "en";
            double f = rand();
            Map<String, Object> fields = f < 0.15 ? Map.of("allergies", "Penicillin") : rand() < 0.2 ? Map.of("conditions", pick(new String[]{"Diabetes", "Hypertension", "Asthma"})) : Map.of();
            UUID id = db.sql("""
                            INSERT INTO contacts (org_id, name, phone, gender, dob, address, preferred_lang, consent_at, fields, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?) RETURNING id""")
                    .params(org, p.name(), p.phone(), p.gender(), LocalDate.of(today.getYear() - age, between(1, 12), between(1, 28)),
                            pick(AREAS) + ", Indore", lang, now.minusDays(between(20, 200)), Json.write(fields), now.minusDays(between(20, 200)))
                    .query(UUID.class).single();
            patients.add(new Patient(id, p.name(), p.phone(), lang));
        }

        Map<String, Object> issuedBy = Map.of("name", "Dr. Anil Sharma", "qualifications", "MBBS, MD (General Medicine)", "registrationNo", "MPMC-23871");
        int invoiceNo = 0;
        for (int dayOffset = 21; dayOffset >= 0; dayOffset--) {
            LocalDate date = today.minusDays(dayOffset);
            if (date.getDayOfWeek() == DayOfWeek.SUNDAY && dayOffset != 0) continue;
            OffsetDateTime start = Ist.startOf(date);
            int count = dayOffset == 0 ? 9 : between(14, 28);
            for (int token = 1; token <= count; token++) {
                Patient patient = pick(patients);
                boolean evening = token > count * 0.6;
                OffsetDateTime checkIn = dayOffset == 0
                        ? now.minusMinutes((long) (count - token + 1) * 9)
                        : start.plusMinutes((long) ((evening ? 17.5 : 10) * 60 + (evening ? token - count * 0.6 : token) * 8));
                String status = dayOffset != 0 ? "DONE" : token <= 3 ? "DONE" : token == 4 ? "IN_PROGRESS" : "WAITING";
                OffsetDateTime startedAt = "WAITING".equals(status) ? null : min(checkIn.plusMinutes(between(5, 40)), now.minusMinutes(1));
                OffsetDateTime completedAt = "DONE".equals(status) ? min(startedAt.plusMinutes(between(4, 11)), now) : null;
                UUID entry = db.sql("""
                                INSERT INTO queue_entries (org_id, date, token_number, contact_id, provider_id, status, public_code, checked_in_at, started_at, completed_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                        .params(org, date, token, patient.id(), owner, status, Ids.publicCode(), checkIn, startedAt, completedAt)
                        .query(UUID.class).single();
                if (!"DONE".equals(status)) continue;

                Case c = pick(CASES);
                List<Map<String, Object>> items = new ArrayList<>();
                for (int m : c.meds()) items.add(medicines.get(m));
                LocalDate followUp = rand() < 0.35 ? date.plusDays(pick(new Integer[]{3, 5, 7, 15})) : null;
                Map<String, Object> clinical = new LinkedHashMap<>();
                clinical.put("vitals", Map.of("bp", between(110, 150) + "/" + between(70, 95), "pulse", String.valueOf(between(68, 102)),
                        "temp", c.diagnosis().contains("fever") ? "100.4" : "98.6", "spo2", String.valueOf(between(96, 99)), "weight", String.valueOf(between(14, 92))));
                clinical.put("complaints", c.complaints());
                clinical.put("findings", "");
                clinical.put("diagnosis", c.diagnosis());
                clinical.put("advice", c.advice());
                UUID encounter = db.sql("""
                                INSERT INTO encounters (org_id, contact_id, provider_id, queue_entry_id, kind, occurred_at, summary, data, follow_up_on)
                                VALUES (?, ?, ?, ?, 'CONSULTATION', ?, ?, ?::jsonb, ?) RETURNING id""")
                        .params(org, patient.id(), owner, entry, completedAt, c.diagnosis(), Json.write(clinical), followUp).query(UUID.class).single();
                Map<String, Object> rx = new LinkedHashMap<>(clinical);
                rx.put("items", items);
                rx.put("followUpOn", followUp == null ? null : followUp.toString());
                rx.put("issuedBy", issuedBy);
                db.sql("INSERT INTO documents (org_id, contact_id, encounter_id, type, title, data, public_code, created_by, created_at) VALUES (?, ?, ?, 'PRESCRIPTION', 'Prescription', ?::jsonb, ?, ?, ?)")
                        .params(org, patient.id(), encounter, Json.write(rx), Ids.publicCode(), doctorId, completedAt).update();
                if (followUp != null) {
                    String taskStatus = followUp.isBefore(today) ? pick(new String[]{"DONE", "DONE", "OPEN"}) : "OPEN";
                    db.sql("INSERT INTO tasks (org_id, contact_id, kind, title, due_on, status, created_at) VALUES (?, ?, 'FOLLOW_UP', 'Follow-up visit', ?, ?, ?)")
                            .params(org, patient.id(), followUp, taskStatus, completedAt).update();
                }
                long fee = rand() < 0.12 ? 0 : 40000;
                List<Object[]> lines = new ArrayList<>();
                lines.add(new Object[]{fee > 0 ? "Consultation" : "Follow-up consultation (free)", fee});
                if (rand() < 0.15) {
                    Object[] extra = pick(new Object[][]{{"Nebulization", 20000L}, {"Injection (administration)", 10000L}, {"ECG", 30000L}});
                    lines.add(extra);
                }
                long total = lines.stream().mapToLong(l -> ((Number) l[1]).longValue()).sum();
                boolean unpaid = rand() < 0.06;
                String mode = rand() < 0.55 ? "CASH" : rand() < 0.9 ? "UPI" : "CARD";
                invoiceNo++;
                UUID invoice = db.sql("""
                                INSERT INTO invoices (org_id, number, contact_id, encounter_id, status, subtotal, total, paid, public_code, created_by, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                        .params(org, invoiceNo, patient.id(), encounter, total == 0 ? "PAID" : unpaid ? "UNPAID" : "PAID", total, total,
                                unpaid ? 0 : total, Ids.publicCode(), receptionId, completedAt)
                        .query(UUID.class).single();
                for (Object[] l : lines) {
                    long price = ((Number) l[1]).longValue();
                    db.sql("INSERT INTO invoice_items (org_id, invoice_id, description, qty, unit_price, amount) VALUES (?, ?, ?, 1, ?, ?)")
                            .params(org, invoice, l[0], price, price).update();
                }
                if (!unpaid && total > 0) {
                    db.sql("INSERT INTO payments (org_id, invoice_id, amount, mode, reference, received_by, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                            .params(org, invoice, total, mode, "UPI".equals(mode) ? "UPI" + between(100000, 999999) : null, receptionId, completedAt).update();
                }
                db.sql("INSERT INTO messages (org_id, contact_id, to_phone, template, body, status, provider, created_at) VALUES (?, ?, ?, 'DOCUMENT_SHARED', ?, 'SENT', 'log', ?)")
                        .params(org, patient.id(), patient.phone(), "hi".equals(patient.lang())
                                ? patient.name() + ", Sharma Family Clinic से आपका पर्चा तैयार है।"
                                : patient.name() + ", your prescription from Sharma Family Clinic is ready.", completedAt)
                        .update();
            }
        }
        db.sql("INSERT INTO counters (org_id, key, value) VALUES (?, 'invoice', ?)").params(org, invoiceNo).update();

        double[][] slots = {{0, 18}, {0, 18.5}, {1, 10}, {1, 10.25}, {1, 11}, {2, 17.5}};
        for (double[] s : slots) {
            OffsetDateTime startsAt = Ist.startOf(today.plusDays((long) s[0])).plusMinutes((long) (s[1] * 60));
            db.sql("INSERT INTO appointments (org_id, contact_id, provider_id, starts_at, source, notes) VALUES (?, ?, ?, ?, ?, ?)")
                    .params(org, pick(patients).id(), owner, startsAt, pick(new String[]{"PHONE", "WHATSAPP"}),
                            pick(new String[]{"Sugar review", "BP check", "Reports review", null}))
                    .update();
        }
    }

    private void seedLegal(UUID ownerId) {
        UUID org = provisioning.provision(new ProvisioningService.NewOrg("Verma & Associates", "Indore", "+917314567890", registry.app("legal"), ownerId));
        db.sql("UPDATE organizations SET address = 'Chamber 214, District Court Complex, Indore' WHERE id = ?").param(org).update();
        UUID owner = db.sql("UPDATE memberships SET qualifications = 'B.A. LL.B., Advocate', registration_no = 'MP/1432/2009' WHERE org_id = ? AND user_id = ? RETURNING id")
                .params(org, ownerId).query(UUID.class).single();
        LocalDate today = Ist.today();
        String[] courts = {"District Court, Indore", "Family Court, Indore", "MP High Court, Indore Bench", "Consumer Forum, Indore"};
        String[] types = {"Civil suit", "Bail application", "Family / matrimonial", "Cheque bounce (NI Act 138)", "Consumer complaint", "Property / revenue"};
        String[] stages = {"Notice / service", "Appearance", "Written statement / reply", "Evidence", "Arguments"};
        String[] outcomes = {"Adjourned at request of opposite counsel.", "Reply filed; matter fixed for evidence.", "Arguments heard in part.", "Witness PW-1 examined."};
        int invoiceNo = 0;
        for (int i = 0; i < 24; i++) {
            Person p = person();
            UUID client = db.sql("INSERT INTO contacts (org_id, name, phone, gender, preferred_lang, consent_at, fields) VALUES (?, ?, ?, ?, ?, now(), ?::jsonb) RETURNING id")
                    .params(org, p.name(), p.phone(), p.gender(), rand() < 0.6 ? "hi" : "en",
                            Json.write(Map.of("occupation", pick(new String[]{"Business", "Service", "Farmer", "Retired", "Homemaker"}))))
                    .query(UUID.class).single();
            LocalDate next = i < 5 ? today : i < 8 ? today.minusDays(between(2, 20)) : today.plusDays(between(1, 45));
            String opponent = pick(new String[]{"State of MP", pick(FIRST_M) + " " + pick(LAST), "ICICI Lombard", pick(FIRST_F) + " " + pick(LAST)});
            UUID matter = db.sql("""
                            INSERT INTO legal_matters (org_id, contact_id, title, case_number, cnr, court, case_type, stage, next_hearing_on, opposite_party)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                    .params(org, client, p.name() + " vs. " + opponent,
                            pick(new String[]{"CS", "MJC", "RCS", "CC", "BA"}) + "/" + between(100, 999) + "/" + (today.getYear() - between(0, 2)),
                            "MPIN01" + between(1_000_000, 9_999_999) + today.getYear(), pick(courts), pick(types), pick(stages), next,
                            pick(new String[]{"State", "Respondent", "Insurance company"}))
                    .query(UUID.class).single();
            for (int h = between(1, 4); h > 0; h--) {
                LocalDate heldOn = today.minusDays((long) h * between(20, 40));
                String outcome = pick(outcomes);
                db.sql("""
                                INSERT INTO encounters (org_id, contact_id, provider_id, ref_type, ref_id, kind, occurred_at, summary, data)
                                VALUES (?, ?, ?, 'matter', ?, 'HEARING', ?, ?, ?::jsonb)""")
                        .params(org, client, owner, matter.toString(), Ist.startOf(heldOn), outcome, Json.write(Map.of("purpose", pick(stages), "outcome", outcome)))
                        .update();
            }
            invoiceNo++;
            long total = pick(new Long[]{500000L, 1000000L, 1500000L, 2500000L});
            long paid = pick(new Long[]{total, total / 2, 0L});
            OffsetDateTime createdAt = Ist.now().minusDays(between(1, 60));
            UUID invoice = db.sql("""
                            INSERT INTO invoices (org_id, number, contact_id, ref_type, ref_id, status, subtotal, total, paid, public_code, created_by, created_at)
                            VALUES (?, ?, ?, 'matter', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                    .params(org, invoiceNo, client, matter.toString(), paid == total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID", total, total, paid,
                            Ids.publicCode(), ownerId, createdAt)
                    .query(UUID.class).single();
            db.sql("INSERT INTO invoice_items (org_id, invoice_id, description, qty, unit_price, amount) VALUES (?, ?, 'Professional fees', 1, ?, ?)")
                    .params(org, invoice, total, total).update();
            if (paid > 0) {
                db.sql("INSERT INTO payments (org_id, invoice_id, amount, mode, received_by, received_at) VALUES (?, ?, ?, ?, ?, ?)")
                        .params(org, invoice, paid, pick(new String[]{"UPI", "BANK", "CASH"}), ownerId, createdAt).update();
            }
        }
        db.sql("INSERT INTO counters (org_id, key, value) VALUES (?, 'invoice', ?)").params(org, invoiceNo).update();
    }

    private static OffsetDateTime min(OffsetDateTime a, OffsetDateTime b) {
        return a.isBefore(b) ? a : b;
    }
}
