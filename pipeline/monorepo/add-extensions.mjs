// The sources import files without an extension and a folder without `/index`; Node and the
// consumers of the types (NodeNext) need both spelled. Run after the compiler on a `dist` folder.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}(?:\/[^'"\n]*)?)\2/g;
const EXTENSION = /\.(?:js|mjs|cjs|json|node)$/;

/** The spelling a relative specifier needs in the emitted file `file` of kind `suffix` (`.js` or `.d.ts`). */
export function spelled(file, specifier, suffix) {
  if (EXTENSION.test(specifier)) {
    return specifier;
  }
  const target = resolve(dirname(file), specifier);
  if (isFile(target + suffix)) {
    return `${specifier}.js`;
  }
  if (isFile(join(target, `index${suffix}`))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  return specifier;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

export function addExtensions(text, file, suffix) {
  return text.replace(SPECIFIER, (...found) => {
    const [match, head, quote, specifier] = found;
    const next = spelled(file, specifier, suffix);
    return next === specifier ? match : `${head}${quote}${next}${quote}`;
  });
}

export function addExtensionsIn(dist) {
  let changed = 0;
  for (const file of emitted(dist)) {
    const suffix = file.endsWith('.d.ts') ? '.d.ts' : '.js';
    const text = readFileSync(file, 'utf8');
    const next = addExtensions(text, file, suffix);
    if (next !== text) {
      writeFileSync(file, next);
      changed++;
    }
  }
  return changed;
}

function* emitted(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* emitted(path);
    } else if (/\.(?:d\.ts|js)$/.test(entry.name)) {
      yield path;
    }
  }
}

if (argv[1] === fileURLToPath(import.meta.url)) {
  for (const dist of argv.slice(2)) {
    if (existsSync(dist)) {
      addExtensionsIn(dist);
    }
  }
}
