package com.arcus.platform.kernel;

import com.arcus.platform.spi.AppDefinition;
import com.arcus.platform.telemetry.Log;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.List;

/**
 * Applies database migrations on startup: the platform's first, then each app's, each with its own history
 * table, so an app's schema evolves independently and the platform never needs to know about it.
 */
@Component
public class Migrations implements InitializingBean {

    private final DataSource dataSource;
    private final List<AppDefinition> apps;

    public Migrations(DataSource dataSource, List<AppDefinition> apps) {
        this.dataSource = dataSource;
        this.apps = apps;
    }

    @Override
    public void afterPropertiesSet() {
        migrate("platform", "classpath:db/platform");
        for (AppDefinition app : apps) migrate("app_" + app.id(), "classpath:db/apps/" + app.id());
    }

    private void migrate(String name, String location) {
        var result = Flyway.configure()
                .dataSource(dataSource)
                .locations(location)
                .table("flyway_" + name)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .failOnMissingLocations(false)
                .load()
                .migrate();
        Log.info("database.migrated", "schema", name, "applied", result.migrationsExecuted);
    }
}
