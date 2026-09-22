/**
 * Server logger.
 *
 * Structured one-line JSON, which is what Vercel and every log drain index
 * best. Values under sensitive-looking keys are replaced before anything is
 * written, so a careless `log.error('x', { body })` cannot put a password in a
 * log line. Request bodies should still not be logged at all.
 */

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|session|hash|api[-_]?key|credential/i;
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  return LEVELS[configured ?? 'info'] ?? LEVELS.info;
}

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((item) => redactForLog(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : redactForLog(inner, depth + 1),
      ]),
    );
  }
  return value;
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (LEVELS[level] < threshold()) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context: redactForLog(context) } : {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  // eslint-disable-next-line no-console -- the logger is the one sanctioned console writer
  else console.log(line);
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
