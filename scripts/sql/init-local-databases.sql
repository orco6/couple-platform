-- Runs once, when the local Postgres volume is first created.
-- The test and E2E suites each get a database they are allowed to destroy.
CREATE DATABASE couple_platform_test OWNER couple_platform;
CREATE DATABASE couple_platform_e2e OWNER couple_platform;
