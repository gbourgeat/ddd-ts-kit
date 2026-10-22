import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { isRecord } from './is-record';

/** The path of the `tsc` script of a compiler named as a package of the project, or as a path. */
export function compilerScript(compiler: string, root: string): string {
  if (path.isAbsolute(compiler) || compiler.startsWith('.')) {
    return path.resolve(root, compiler);
  }

  const manifestPath = createRequire(path.join(root, 'package.json')).resolve(`${compiler}/package.json`);
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = isRecord(manifest) && isRecord(manifest.bin) ? manifest.bin.tsc : undefined;

  if (typeof bin !== 'string') {
    throw new Error(`The package "${compiler}" ships no tsc: name the compiler to use.`);
  }

  return path.join(path.dirname(manifestPath), bin);
}
