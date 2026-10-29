package com.arcus.platform.kernel;

import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.TransactionDefinition;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Scopes every transaction to the current organization for Postgres row-level security.
 * {@code set_config(..., true)} is transaction-local, so pooled connections never leak a tenant.
 * Work outside a transaction has no organization set and therefore sees no tenant rows (fails closed).
 */
public class TenantTransactionManager extends JdbcTransactionManager {

    public TenantTransactionManager(DataSource dataSource) {
        super(dataSource);
    }

    @Override
    protected void prepareTransactionalConnection(Connection con, TransactionDefinition definition) throws SQLException {
        super.prepareTransactionalConnection(con, definition);
        String org = TenantContext.orgId().map(Object::toString).orElse("");
        String bypass = TenantContext.isSystem() ? "on" : "off";
        try (PreparedStatement st = con.prepareStatement("SELECT set_config('arcus.org_id', ?, true), set_config('arcus.bypass', ?, true)")) {
            st.setString(1, org);
            st.setString(2, bypass);
            st.execute();
        }
    }
}
