import type { Config } from '../../config/index.js';
import type { SourceFile } from '../model/source-file.js';
import { scan } from '../scan/scan.js';
import { readStructure, type Structure } from '../structure/read-structure.js';
import { isTestFile } from './is-test-file.js';
import { locate } from './locate.js';
import { resolveImport } from './resolve-import.js';

/** What the rules read of one source: where it is, its blanked code, its imports and, on first use, its declarations. */
export function loadSourceFile(config: Config, file: string, text: string): SourceFile {
  const location = locate(config, file);
  const scanned = scan(text);
  let structure: Structure | undefined;

  return {
    get structure(): Structure {
      structure ??= readStructure(scanned);

      return structure;
    },
    path: file,
    location,
    isTest: isTestFile(file, location),
    text,
    scan: scanned,
    imports: scanned.imports.map(({ specifier, line, names, typeNames }) => ({ specifier, line, names, typeNames, target: resolveImport(config, file, specifier) })),
  };
}
