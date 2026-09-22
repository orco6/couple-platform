// Replaces invisible/format Unicode characters in source files with escape
// sequences. Invisible characters in code cannot be reviewed; escapes can.
//   node scripts/escape-invisible.mjs src scripts          fix
//   node scripts/escape-invisible.mjs --check src scripts  fail if any found (CI)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ranges = [
  // C0 controls except tab (0x09), line feed (0x0a) and carriage return (0x0d); DEL.
  [0x0000, 0x0008], [0x000b, 0x000c], [0x000e, 0x001f], [0x007f, 0x007f],
  [0x00a0, 0x00a0], [0x061c, 0x061c], [0x1680, 0x1680], [0x2000, 0x200f],
  [0x2028, 0x202f], [0x205f, 0x205f], [0x2066, 0x2069], [0x3000, 0x3000], [0xfeff, 0xfeff],
];
const isInvisible = (code) => ranges.some(([from, to]) => code >= from && code <= to);
const BACKSLASH = String.fromCharCode(92);

const check = process.argv.includes('--check');
const roots = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
let changed = 0;

function walk(path) {
  if (statSync(path).isDirectory()) {
    if (/node_modules|generated|\.next/.test(path)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }
  if (!/\.(ts|tsx|mjs|js)$/.test(path)) return;
  const source = readFileSync(path, 'utf8');
  let next = '';
  for (const char of source) {
    const code = char.codePointAt(0);
    next += isInvisible(code) ? `${BACKSLASH}u${code.toString(16).padStart(4, '0')}` : char;
  }
  if (next !== source) {
    changed += 1;
    console.log(`${check ? 'invisible characters in' : 'escaped'}: ${path}`);
    if (!check) writeFileSync(path, next);
  }
}

for (const root of roots) walk(root);
console.log(`${changed} file(s) ${check ? 'with invisible characters' : 'changed'}`);
if (check && changed > 0) process.exit(1);
