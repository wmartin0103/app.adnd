// Bundles ES modules from src/ into one plain <script> body, for the
// standalone HTML tools (which open straight from disk, where browsers
// won't load module files). Each module keeps its own scope; its exports
// are handed to the modules that import them.
//
//   bundle(['src/rules/tables.js', …], { expose: { SheetConverter: ['adapters/dm-helper', ['toDMHelper']] } })
//
// Modules must be listed after the modules they import.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const key = file => file.replace(/^.*src\//, '').replace(/\.js$/, '');

export function bundle(files, { expose = {} } = {}) {
  const parts = ['(() => {', 'const __m = {};'];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const imports = [];
    const body = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';\s*$/gm, (_, names, from) => {
      const target = key(path.join(path.dirname(file), from));
      imports.push(`const {${names.trim()}} = __m[${JSON.stringify(target)}];`);
      return '';
    });
    const exported = [...body.matchAll(/^export\s+(?:function|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    const code = body.replace(/^export\s+/gm, '');
    parts.push(`// ── ${key(file)} ──`);
    parts.push(`__m[${JSON.stringify(key(file))}] = (() => {\n${imports.join('\n')}\n${code}\nreturn { ${exported.join(', ')} };\n})();`);
  }
  for (const [global, [mod, names]] of Object.entries(expose)) {
    parts.push(`window.${global} = { ${names.map(n => `${n}: __m[${JSON.stringify(mod)}].${n}`).join(', ')} };`);
  }
  parts.push('})();');
  return parts.join('\n');
}

export const RULES_FILES = [
  'src/rules/tables.js',
  'src/rules/dice.js',
  'src/rules/weapons.js',
  'src/rules/attacks.js',
  'src/rules/character.js',
  'src/rules/migrate.js',
  'src/adapters/dm-helper.js',
];
