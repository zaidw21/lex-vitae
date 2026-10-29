-- Runs once when the local Postgres volume is created (docker-compose.yml).
-- The API must connect as an ordinary role: row-level security does not apply to superusers or BYPASSRLS roles,
-- and the API refuses to start with one.
CREATE ROLE arcus LOGIN PASSWORD 'arcus' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE DATABASE arcus OWNER arcus;
