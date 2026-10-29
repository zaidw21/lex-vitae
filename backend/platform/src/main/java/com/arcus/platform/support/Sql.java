package com.arcus.platform.support;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** Small helpers for reading JDBC rows. */
public final class Sql {

    private Sql() {
    }

    public static UUID uuid(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, UUID.class);
    }

    public static OffsetDateTime time(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }

    public static LocalDate date(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, LocalDate.class);
    }

    public static List<String> strings(ResultSet rs, String column) throws SQLException {
        Array array = rs.getArray(column);
        if (array == null) return List.of();
        return Arrays.stream((Object[]) array.getArray()).map(String::valueOf).toList();
    }

    public static Integer intOrNull(ResultSet rs, String column) throws SQLException {
        int v = rs.getInt(column);
        return rs.wasNull() ? null : v;
    }
}
