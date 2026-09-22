# 0002 — Authentication

Status: Accepted (2026-09-16)

## Context
Small-business apps have a handful of staff accounts created by an administrator, used on shared office
computers and personal phones. Revocation (someone leaves, a phone is lost) must be immediate. The
deployment target is serverless (many short-lived instances). Koma used DB sessions and bcryptjs, with
an in-memory login throttle that does not hold across instances.

## Decision
- **Sessions in PostgreSQL**, opaque 256-bit tokens, SHA-256 stored, httpOnly/SameSite=Lax/Secure
  (`__Host-` prefix over HTTPS). Idle 7 days (sliding, refreshed at most hourly), absolute 30 days.
  User status and role re-checked every request. No JWTs: they cannot be revoked before expiry.
- **scrypt** from `node:crypto` (N=2^15, r=8, p=1, 64-byte key, parameters encoded in the hash, upgraded
  on sign-in). bcrypt rejected: 72-byte truncation (Hebrew passphrases are 2 bytes per letter) and the
  pure-JS implementation. argon2 rejected: native binding friction on serverless builds.
- **Throttling in PostgreSQL**: per hashed username (5/15 min) and per hashed client address (50/15 min),
  atomic upsert. Redis rejected: an extra service for a problem the database handles at this scale.
- **Administrator-driven credentials**: no self-service email reset in the foundation (many small
  businesses have staff without work email). Admins generate one-time temporary passwords; users must
  change them; enforced on API and pages.
- Password normalization (bidi/zero-width/edges/NFC) shared by client and server — Koma's paste bug.
- NIST-style policy: length ≥10, blocklist, no composition rules, no forced rotation.

## Consequences
- One DB read per request for session resolution (cached per request with React `cache`).
- Lockout can be abused to lock a known username for 15 minutes; admin reset clears it.
- Adding 2FA or email reset later is additive (new tables, new routes), not a redesign.
