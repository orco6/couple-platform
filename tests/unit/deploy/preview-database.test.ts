import { describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs build script, deliberately without types.
import { planPreviewDatabase } from '../../../scripts/preview-database.mjs';

const direct = 'postgresql://owner:pw@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const ready = {
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  PREVIEW_DB_SETUP: '1',
  PREVIEW_DB_CONFIRM: 'neondb',
  DATABASE_URL_UNPOOLED: direct,
  REVIEW_PASSWORD_HASHES: 'eyJhIjoic2NyeXB0JC4uLiJ9',
};

describe('planPreviewDatabase', () => {
  it('does nothing in an ordinary build (a push to main never migrates)', () => {
    const { PREVIEW_DB_SETUP: _flag, ...ordinary } = ready;
    expect(planPreviewDatabase(ordinary)).toEqual({ run: false, reason: expect.any(String) });
    expect(planPreviewDatabase({})).toMatchObject({ run: false });
  });

  it('migrates a flagged preview build over the direct URL', () => {
    expect(planPreviewDatabase(ready)).toEqual({ run: true, url: direct, database: 'neondb' });
  });

  it('falls back to the other unpooled names', () => {
    const { DATABASE_URL_UNPOOLED: _url, ...rest } = ready;
    expect(planPreviewDatabase({ ...rest, POSTGRES_URL_NON_POOLING: direct })).toMatchObject({ run: true });
  });

  it('fails a flagged production or local build instead of ignoring the flag', () => {
    expect(planPreviewDatabase({ ...ready, VERCEL_ENV: 'production' }).error).toMatch(/only allowed in a Vercel preview/);
    expect(planPreviewDatabase({ ...ready, VERCEL: undefined }).error).toMatch(/only allowed in a Vercel preview/);
  });

  it('refuses unless the confirmation names the database', () => {
    expect(planPreviewDatabase({ ...ready, PREVIEW_DB_CONFIRM: 'other' }).error).toMatch(/does not name this database/);
    expect(planPreviewDatabase({ ...ready, PREVIEW_DB_CONFIRM: undefined }).error).toMatch(/does not name this database/);
  });

  it('refuses without a usable direct URL or the password hashes, and never echoes the URL', () => {
    const { DATABASE_URL_UNPOOLED: _url, ...noUrl } = ready;
    expect(planPreviewDatabase(noUrl).error).toMatch(/no direct database URL/);
    const sensitive = planPreviewDatabase({ ...ready, DATABASE_URL_UNPOOLED: '[SENSITIVE]' });
    expect(sensitive.error).toMatch(/not a valid connection string/);
    expect(planPreviewDatabase({ ...ready, REVIEW_PASSWORD_HASHES: undefined }).error).toMatch(/REVIEW_PASSWORD_HASHES/);
    for (const env of [ready, { ...ready, PREVIEW_DB_CONFIRM: 'x' }]) {
      expect(JSON.stringify(planPreviewDatabase(env).error ?? '')).not.toContain('pw@');
    }
  });
});
