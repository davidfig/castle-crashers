// Enforces the determinism rules from docs/01-architecture.md and ADR-0004:
//  - sim/ and engine/ may not use nondeterministic APIs
//  - sim/, data/, campaign/ and ai/ may not import platform/, render/, or ui/
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED_CALLS = /\b(Math\.(sin|cos|tan|asin|acos|atan|atan2|pow|exp|log|log2|log10|hypot|random|sinh|cosh|tanh|cbrt|expm1|log1p)|Date\.now|performance\.now|new Date|crypto\.getRandomValues)\b/;
const BANNED_IMPORT = /from\s+['"][^'"]*\/(platform|render|ui)(\/[^'"]*)?['"]/;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, '');
}

let bad = 0;
for (const dir of ['src/sim', 'src/engine', 'src/data', 'src/campaign', 'src/ai']) {
  for (const file of walk(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    strip(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
      if (BANNED_CALLS.test(line)) { console.error(`${file}:${i + 1}: nondeterministic API: ${line.trim()}`); bad++; }
      if (dir !== 'src/engine' && BANNED_IMPORT.test(line)) { console.error(`${file}:${i + 1}: forbidden import: ${line.trim()}`); bad++; }
    });
  }
}
if (bad) { console.error(`${bad} violation(s)`); process.exit(1); }
console.log('sim determinism check: ok');
