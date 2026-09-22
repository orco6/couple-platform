/** The integration suite's database. Override with TEST_DATABASE_URL (must still be local and end in _test). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://couple_platform:couple_platform-local-only@127.0.0.1:5436/couple_platform_test';
