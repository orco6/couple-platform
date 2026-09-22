-- Runs once, when the local Postgres volume is first created.
-- The test and E2E suites each get a database they are allowed to destroy.
CREATE DATABASE bpf_test OWNER bpf;
CREATE DATABASE bpf_e2e OWNER bpf;
