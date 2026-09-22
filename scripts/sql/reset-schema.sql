-- Drops everything in the public schema so migrations can replay from empty.
-- Only ever executed through scripts that have already verified the target is
-- a local, non-production database (see src/core/db/safety.ts).
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
