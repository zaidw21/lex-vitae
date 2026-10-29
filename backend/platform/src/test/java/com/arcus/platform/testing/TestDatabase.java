package com.arcus.platform.testing;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * The database for integration tests, connected as an ordinary role so row-level security is really
 * enforced (superusers bypass it). Uses ARCUS_TEST_DB_URL / _USER / _PASSWORD when set (an existing,
 * non-superuser database), otherwise starts a throwaway Postgres with Testcontainers.
 */
public final class TestDatabase {

    public record Connection(String url, String user, String password) {
    }

    private static Connection connection;

    private TestDatabase() {
    }

    public static synchronized Connection get() {
        if (connection != null) return connection;
        String url = System.getenv("ARCUS_TEST_DB_URL");
        if (url != null && !url.isBlank()) {
            connection = new Connection(url, System.getenv().getOrDefault("ARCUS_TEST_DB_USER", "arcus"),
                    System.getenv().getOrDefault("ARCUS_TEST_DB_PASSWORD", "arcus"));
            return connection;
        }
        PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");
        postgres.start();
        try (java.sql.Connection admin = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement st = admin.createStatement()) {
            st.execute("CREATE ROLE arcus_app LOGIN PASSWORD 'arcus_app' NOSUPERUSER NOBYPASSRLS");
            st.execute("CREATE DATABASE arcus_test OWNER arcus_app");
        } catch (SQLException e) {
            throw new IllegalStateException("Could not prepare the test database", e);
        }
        String appUrl = postgres.getJdbcUrl().replaceFirst("/" + postgres.getDatabaseName(), "/arcus_test");
        connection = new Connection(appUrl, "arcus_app", "arcus_app");
        return connection;
    }

    /** Use from {@code @DynamicPropertySource} in Spring Boot tests. */
    public static void register(DynamicPropertyRegistry registry) {
        Connection c = get();
        registry.add("spring.datasource.url", c::url);
        registry.add("spring.datasource.username", c::user);
        registry.add("spring.datasource.password", c::password);
    }

    /** A raw connection as the application role, for tests that check the database itself. */
    public static java.sql.Connection open() throws SQLException {
        Connection c = get();
        return DriverManager.getConnection(c.url(), c.user(), c.password());
    }

}
