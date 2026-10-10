// Run with plain `node`, no flag, from the root of a built project: imports every compiled module
// and answers which ones Node could not link. ES modules are linked before anything runs, so one
// specifier that resolves nowhere, anywhere in the graph of a module, fails its import with a
// resolution code; an error thrown later, while a module runs, is not a resolution failure.
//
//   node link-compiled.mjs <outDir> <alias prefix>...
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RESOLUTION_CODES = [
  'ERR_MODULE_NOT_FOUND',
  'ERR_PACKAGE_IMPORT_NOT_DEFINED',
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'ERR_INVALID_MODULE_SPECIFIER',
  'ERR_UNSUPPORTED_DIR_IMPORT',
];
// Entry points and scripts act when imported: each is run on its own by the spec.
const ACTS_ON_IMPORT = /(?:^|\/)(?:main\.js$|scripts\/)/;
const prefixes = process.argv.slice(3).map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
// An alias the build left in the output: Node knows none.
const ALIAS_IMPORT = new RegExp(`(?:from|import\\()\\s*['"](?:${prefixes.join('|')})`);
const RELATIVE_IMPORT = /(?:from|import\()\s*['"]\.{1,2}\//;

const emitted = filesUnder(process.argv[2] ?? 'dist').filter((file) => /\.(?:js|d\.ts)$/.test(file));
const report = { modules: 0, aliased: [], relative: 0, linked: 0, unresolved: [] };

for (const file of emitted) {
  const text = fs.readFileSync(file, 'utf8');

  if (ALIAS_IMPORT.test(text)) {
    report.aliased.push(file);
  }

  if (!file.endsWith('.js')) {
    continue;
  }

  if (RELATIVE_IMPORT.test(text)) {
    report.relative += 1;
  }

  if (ACTS_ON_IMPORT.test(file)) {
    continue;
  }

  report.modules += 1;

  try {
    await import(pathToFileURL(path.resolve(file)).href);
    report.linked += 1;
  } catch (error) {
    if (RESOLUTION_CODES.includes(error?.code)) {
      report.unresolved.push(`${file}: ${error.message}`);
    } else {
      report.linked += 1;
    }
  }
}

console.log(JSON.stringify(report));
process.exit(0);

function filesUnder(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? filesUnder(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
    );
}
