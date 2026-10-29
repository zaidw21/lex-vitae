package com.arcus.platform.orgs;

import com.arcus.platform.kernel.Tx;
import com.arcus.platform.spi.AppDefinition;
import com.arcus.platform.spi.ServiceDefault;
import com.arcus.platform.support.Ids;
import com.arcus.platform.support.Json;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** Creates an organization running an app: owner membership, the app's modules, starter catalog, app setup. */
@Service
public class ProvisioningService {

    private final JdbcClient db;
    private final Tx tx;

    public ProvisioningService(JdbcClient db, Tx tx) {
        this.db = db;
        this.tx = tx;
    }

    public record NewOrg(String name, String city, String phone, AppDefinition app, UUID ownerUserId) {
    }

    public UUID provision(NewOrg input) {
        return tx.system(() -> {
            String base = Ids.slugify(input.name() + " " + (input.city() == null ? "" : input.city()));
            if (base.isEmpty()) base = "practice";
            String slug = base;
            for (int i = 2; db.sql("SELECT count(*) FROM organizations WHERE slug = ?").param(slug).query(Long.class).single() > 0; i++) {
                slug = base + "-" + i;
            }
            AppDefinition app = input.app();
            UUID orgId = db.sql("""
                            INSERT INTO organizations (name, slug, app, modules, city, phone, settings)
                            VALUES (?, ?, ?, ?, ?, ?, ?::jsonb) RETURNING id""")
                    .params(input.name(), slug, app.id(), app.modules().toArray(String[]::new), input.city(), input.phone(),
                            Json.write(app.defaultSettings()))
                    .query(UUID.class).single();
            db.sql("INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'OWNER')").params(orgId, input.ownerUserId()).update();
            for (ServiceDefault s : app.defaultServices()) {
                db.sql("INSERT INTO catalog_items (org_id, kind, name, price) VALUES (?, 'SERVICE', ?, ?)")
                        .params(orgId, s.name(), s.rupees() * 100).update();
            }
            app.provision(orgId, db);
            return orgId;
        });
    }
}
