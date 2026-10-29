package com.arcus.server;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.Tx;
import com.arcus.platform.orgs.ProvisioningService;
import com.arcus.platform.testing.TestDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Tenant isolation is enforced by Postgres row-level security, independent of application code. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TenantIsolationTest {

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry) {
        TestDatabase.register(registry);
    }

    @Autowired JdbcClient db;
    @Autowired Tx tx;
    @Autowired ProvisioningService provisioning;
    @Autowired AppRegistry registry;

    UUID orgA, orgB, contactA, contactB;

    @BeforeAll
    void setUp() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        UUID user = tx.system(() -> db.sql("INSERT INTO users (email, name, password_hash) VALUES (?, 'T', 'x') RETURNING id")
                .param("iso-" + tag + "@example.com").query(UUID.class).single());
        orgA = provisioning.provision(new ProvisioningService.NewOrg("Iso A " + tag, null, null, registry.app("clinic"), user));
        orgB = provisioning.provision(new ProvisioningService.NewOrg("Iso B " + tag, null, null, registry.app("legal"), user));
        contactA = tx.asOrg(orgA, () -> insertContact(orgA, "Asha A"));
        contactB = tx.asOrg(orgB, () -> insertContact(orgB, "Bina B"));
        tx.asOrg(orgB, () -> db.sql("INSERT INTO legal_matters (org_id, contact_id, title) VALUES (?, ?, 'B case')").params(orgB, contactB).update());
    }

    private UUID insertContact(UUID org, String name) {
        return db.sql("INSERT INTO contacts (org_id, name, phone) VALUES (?, ?, '+919800000001') RETURNING id").params(org, name).query(UUID.class).single();
    }

    @Test
    void readsAreLimitedToTheCurrentOrganization() {
        List<UUID> visible = tx.asOrg(orgA, () -> db.sql("SELECT id FROM contacts").query(UUID.class).list());
        assertThat(visible).contains(contactA).doesNotContain(contactB);
        assertThat(tx.asOrg(orgA, () -> db.sql("SELECT count(*) FROM organizations").query(Long.class).single())).isEqualTo(1);
        assertThat(tx.asOrg(orgA, () -> db.sql("SELECT count(*) FROM contacts WHERE id = ?").param(contactB).query(Long.class).single())).isZero();
    }

    @Test
    void writesCannotTouchAnotherOrganization() {
        assertThat(tx.asOrg(orgA, () -> db.sql("UPDATE contacts SET name = 'hacked' WHERE id = ?").param(contactB).update())).isZero();
        assertThat(tx.asOrg(orgA, () -> db.sql("DELETE FROM contacts WHERE id = ?").param(contactB).update())).isZero();
        assertThatThrownBy(() -> tx.asOrg(orgA, () -> insertContact(orgB, "Sneaky"))).isInstanceOf(DataAccessException.class);
        assertThat(tx.system(() -> db.sql("SELECT name FROM contacts WHERE id = ?").param(contactB).query(String.class).single())).isEqualTo("Bina B");
    }

    @Test
    void appOwnedTablesAreIsolatedToo() {
        assertThat(tx.asOrg(orgA, () -> db.sql("SELECT count(*) FROM legal_matters").query(Long.class).single())).isZero();
        assertThat(tx.asOrg(orgB, () -> db.sql("SELECT count(*) FROM legal_matters").query(Long.class).single())).isEqualTo(1);
    }

    @Test
    void withoutAnOrganizationNothingIsVisibleOrWritable() {
        TenantContext.clear();
        assertThat(tx.run(() -> db.sql("SELECT count(*) FROM contacts").query(Long.class).single())).isZero();
        assertThatThrownBy(() -> tx.run(() -> insertContact(orgA, "Nobody"))).isInstanceOf(DataAccessException.class);
        // and outside any transaction (no tenant set on the connection)
        assertThat(db.sql("SELECT count(*) FROM contacts").query(Long.class).single()).isZero();
    }

    /** Platform-internal tables that carry an org_id but are only ever read in system scope. */
    private static final List<String> SYSTEM_ONLY = List.of("sessions");

    @Test
    void everyTableWithAnOrgIdHasForcedRowLevelSecurity() {
        List<String> unprotected = db.sql("""
                        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relkind = 'r'
                          AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_name = c.relname AND col.column_name = 'org_id')
                          AND NOT (c.relrowsecurity AND c.relforcerowsecurity)""")
                .query(String.class).list().stream().filter(t -> !SYSTEM_ONLY.contains(t)).toList();
        assertThat(unprotected).as("tables with org_id but without forced row-level security").isEmpty();
    }

    @Test
    void theApplicationRoleCannotBypassRowLevelSecurity() {
        assertThat(db.sql("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user").query(Boolean.class).single()).isFalse();
    }
}
