package com.arcus.platform.kernel;

import com.arcus.platform.telemetry.Log;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Row-level security silently does nothing for superusers and BYPASSRLS roles. Refuse to start in that case,
 * so tenant isolation can never be switched off by a misconfigured connection.
 */
@Component
public class DatabaseSafetyCheck implements InitializingBean {

    private final JdbcClient jdbc;
    private final ArcusProperties props;

    public DatabaseSafetyCheck(JdbcClient jdbc, ArcusProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    @Override
    public void afterPropertiesSet() {
        boolean bypasses = jdbc.sql("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user")
                .query(Boolean.class).single();
        if (!bypasses) return;
        String message = "The database role bypasses row-level security (superuser or BYPASSRLS), so tenant isolation "
                + "would not be enforced. Connect as an ordinary role (see backend/README.md).";
        if (!props.allowRlsBypassRole()) throw new IllegalStateException(message);
        Log.warn("database.rls_bypassed", "detail", message);
    }
}
