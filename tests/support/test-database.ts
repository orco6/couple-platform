/** The integration suite's database. Override with TEST_DATABASE_URL (must still be local and end in _test). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://bpf:bpf-local-only@127.0.0.1:5434/bpf_test';
