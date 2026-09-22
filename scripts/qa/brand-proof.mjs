// npm run qa:brand-proof — needs the E2E database seeded (run npm run e2e once) and webkit installed.
// Overwrites src/brand/theme.css and src/app/layout.tsx temporarily and restores them byte-for-byte.
// Brand flexibility proof: five identities, brand-layer files only (theme tokens + font import).
// For each: apply, build, start on :3300 against the E2E database, capture, stop. Restores originals.
import { execSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, webkit, devices } from '@playwright/test';

const THEME = 'src/brand/theme.css';
const LAYOUT = 'src/app/layout.tsx';
const BACKUP = '.tmp/brand-proof-backup';
mkdirSync(BACKUP, { recursive: true });
copyFileSync(THEME, `${BACKUP}/theme.css`);
copyFileSync(LAYOUT, `${BACKUP}/layout.tsx`);
const originalTheme = readFileSync(`${BACKUP}/theme.css`, 'utf8');
const originalLayout = readFileSync(`${BACKUP}/layout.tsx`, 'utf8');

const E2E_DB = 'postgresql://bpf:bpf-local-only@127.0.0.1:5434/bpf_e2e';
const PORT = 3300;

const variants = [
  {
    id: 'law',
    name: 'Premium law office — ivory paper, burgundy, serif titles, spacious, square',
    fonts: { sans: ['Assistant', "subsets: ['hebrew', 'latin'], weight: ['400', '600', '700']"], display: ['Frank_Ruhl_Libre', "subsets: ['hebrew', 'latin'], weight: ['500', '700']"] },
    tokens: {
      canvas: '#f5f2ea', surface: '#fffdf7', sunken: '#f8f5ee', hover: '#f3efe5', selected: '#f3e9ea',
      ink: '#1f1b16', 'ink-muted': '#554c42', 'ink-subtle': '#6a6055',
      'rule-faint': '#ece6da', rule: '#ddd4c4', 'rule-strong': '#bfb3a0',
      accent: '#6b1f2a', 'accent-hover': '#541721', 'accent-tint': '#f3e6e7', 'accent-text': '#6b1f2a', focus: '#8b3040',
      'font-display': 'var(--font-brand-display)', 'title-weight': '500', 'section-weight': '500',
      'text-title': '1.75rem', 'text-section': '1.25rem', 'row-padding-y': '1rem', chrome: 'var(--brand-canvas)',
      'radius-chip': '2px', 'radius-control': '3px', 'radius-surface': '2px', 'radius-dialog': '6px', 'radius-sheet': '10px',
    },
  },
  {
    id: 'dental',
    name: 'Modern dental clinic — cool clinical white, teal-blue, soft, calm',
    fonts: { sans: ['Heebo', "subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700']"] },
    tokens: {
      canvas: '#f2f6f8', surface: '#ffffff', sunken: '#f6f9fb', hover: '#eef4f7', selected: '#e3f1f5',
      ink: '#10222c', 'ink-muted': '#47606d', 'ink-subtle': '#5b717d',
      'rule-faint': '#e6eef2', rule: '#d3e0e6', 'rule-strong': '#aebfc8',
      accent: '#0b6a86', 'accent-hover': '#08566d', 'accent-tint': '#e1f1f6', 'accent-text': '#095e77', focus: '#1485a6',
      'title-weight': '600', 'section-weight': '600', 'text-title': '1.5rem', 'row-padding-y': '0.875rem',
      'radius-chip': '999px', 'radius-control': '12px', 'radius-surface': '14px', 'radius-dialog': '20px', 'radius-sheet': '24px',
    },
  },
  {
    id: 'garage',
    name: 'Operational garage — workshop grey, safety orange, dense, hard edges',
    fonts: { sans: ['Rubik', "subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700']"] },
    tokens: {
      canvas: '#e9e8e4', surface: '#ffffff', sunken: '#f2f1ee', hover: '#efeeea', selected: '#fbeee2',
      ink: '#141414', 'ink-muted': '#4a4a47', 'ink-subtle': '#5e5e5a',
      'rule-faint': '#e2e1dc', rule: '#cfcdc6', 'rule-strong': '#9f9d95',
      accent: '#a84300', 'accent-hover': '#8a3700', 'accent-tint': '#fbeadc', 'accent-text': '#9a3d00', focus: '#c85200',
      'title-weight': '700', 'section-weight': '700', 'text-title': '1.375rem', 'text-section': '1rem', 'row-padding-y': '0.5rem',
      chrome: 'var(--brand-canvas)',
      'radius-chip': '2px', 'radius-control': '4px', 'radius-surface': '4px', 'radius-dialog': '6px', 'radius-sheet': '10px',
    },
  },
  {
    id: 'studio',
    name: 'Creative design studio — bright paper, cobalt, display face, large titles',
    fonts: { sans: ['Heebo', "subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700']"], display: ['Secular_One', "subsets: ['hebrew', 'latin'], weight: '400'"] },
    tokens: {
      canvas: '#faf8f3', surface: '#ffffff', sunken: '#f6f3ec', hover: '#f3f1ea', selected: '#e9ecfb',
      ink: '#121212', 'ink-muted': '#4d4d4d', 'ink-subtle': '#626262',
      'rule-faint': '#ece9e2', rule: '#d9d5cc', 'rule-strong': '#b5b0a5',
      accent: '#2436c4', 'accent-hover': '#1b2aa0', 'accent-tint': '#e8ebfb', 'accent-text': '#1f2fb0', focus: '#3a4ee0',
      'font-display': 'var(--font-brand-display)', 'title-weight': '400', 'section-weight': '400',
      'text-title': '2.125rem', 'text-section': '1.375rem', 'row-padding-y': '1rem',
      'radius-chip': '0px', 'radius-control': '0px', 'radius-surface': '0px', 'radius-dialog': '0px', 'radius-sheet': '16px',
    },
  },
  {
    id: 'realestate',
    name: 'Serious real-estate office — stone and slate green, ledger density, rules',
    fonts: { sans: ['Heebo', "subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700']"] },
    tokens: {
      canvas: '#f0f1ee', surface: '#ffffff', sunken: '#f5f6f3', hover: '#eff1ec', selected: '#e6efeb',
      ink: '#1a2024', 'ink-muted': '#4b5559', 'ink-subtle': '#5f696c',
      'rule-faint': '#e6e8e3', rule: '#d4d8d1', 'rule-strong': '#aeb4ab',
      accent: '#2f5145', 'accent-hover': '#243f36', 'accent-tint': '#e4ede9', 'accent-text': '#2a483e', focus: '#3d6a5b',
      'title-weight': '700', 'section-weight': '600', 'row-padding-y': '0.625rem', chrome: 'var(--brand-canvas)',
      'radius-chip': '3px', 'radius-control': '6px', 'radius-surface': '6px', 'radius-dialog': '10px', 'radius-sheet': '16px',
    },
  },
];

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function applyVariant(v) {
  const block = Object.entries(v.tokens).map(([k, val]) => `  --brand-${k}: ${val};`).join('\n');
  writeFileSync(THEME, `${originalTheme}\n/* BRAND PROOF: ${v.name} */\n:root {\n${block}\n}\n`);
  const [sansName, sansOpts] = v.fonts.sans;
  const display = v.fonts.display;
  let layout = originalLayout
    .replace("import { IBM_Plex_Sans_Hebrew } from 'next/font/google';", `import { ${sansName}${display ? `, ${display[0]}` : ''} } from 'next/font/google';`)
    .replace(/const brandSans = IBM_Plex_Sans_Hebrew\(\{[\s\S]*?\}\);/, `const brandSans = ${sansName}({ ${sansOpts}, variable: '--font-brand-sans', display: 'swap' });${display ? `\nconst brandDisplay = ${display[0]}({ ${display[1]}, variable: '--font-brand-display', display: 'swap' });` : ''}`)
    .replace('className={brandSans.variable}', display ? 'className={`${brandSans.variable} ${brandDisplay.variable}`}' : 'className={brandSans.variable}');
  if (layout === originalLayout) throw new Error('layout replacement failed');
  writeFileSync(LAYOUT, layout);
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server did not start');
}

async function capture(v) {
  const out = `screenshots/brand/${v.id}`;
  mkdirSync(out, { recursive: true });
  for (const [type, ctx, tag] of [[chromium, { viewport: { width: 1440, height: 900 } }, 'desktop'], [webkit, devices['iPhone 13'], 'iphone']]) {
    const browser = await type.launch();
    const context = await browser.newContext({ ...ctx, locale: 'he-IL', baseURL: `http://localhost:${PORT}` });
    const page = await context.newPage();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${out}/${tag}-1-login.png` });
    await page.getByLabel('שם משתמש').fill('owner');
    await page.getByLabel('סיסמה', { exact: true }).fill('yesod-dev-password');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${tag}-2-customers.png` });
    if (tag === 'desktop') {
      const href = await page.locator('main table tbody a').first().getAttribute('href');
      await page.goto(href);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${tag}-3-detail.png` });
      await page.goto('/design-system#record-states');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${tag}-4-record-states.png` });
      await page.getByRole('button', { name: 'פתיחת דיאלוג', exact: true }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${tag}-5-dialog.png` });
    }
    await browser.close();
  }
}

const results = [];
try {
  for (const v of variants) {
    const t = v.tokens;
    results.push(`${v.id}: accent-text on surface ${ratio(t['accent-text'], t.surface).toFixed(1)}:1, ink-subtle on surface ${ratio(t['ink-subtle'], t.surface).toFixed(1)}:1, on-accent white ${ratio('#ffffff', t.accent).toFixed(1)}:1`);
    applyVariant(v);
    execSync('npm run build', { stdio: 'pipe' });
    const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env: { ...process.env, APP_ENV: 'test', DATABASE_URL: E2E_DB, DIRECT_URL: E2E_DB, LOG_LEVEL: 'warn' }, shell: true, stdio: 'ignore' });
    try {
      await waitFor(`http://localhost:${PORT}/api/health`, 120000);
      await capture(v);
      results.push(`${v.id}: captured`);
    } finally {
      execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`, { stdio: 'ignore' });
      server.kill();
    }
  }
} finally {
  writeFileSync(THEME, originalTheme);
  writeFileSync(LAYOUT, originalLayout);
  results.push(`restored: theme ${readFileSync(THEME, 'utf8') === originalTheme}, layout ${readFileSync(LAYOUT, 'utf8') === originalLayout}`);
  mkdirSync('screenshots/brand', { recursive: true });
  writeFileSync('screenshots/brand/results.txt', results.join('\n') + '\n');
  console.log(results.join('\n'));
}
