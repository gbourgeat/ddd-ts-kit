import type { Config } from '../../config';
import type { SourceFile } from '../model/source-file';
import { scan } from '../scan/scan';
import { readStructure, type Structure } from '../structure/read-structure';
import { isTestFile } from './is-test-file';
import { locate } from './locate';
import { resolveImport } from './resolve-import';

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
    imports: scanned.imports.map(({ specifier, line, names, typeNames }) => ({
      specifier,
      line,
      names,
      typeNames,
      target: resolveImport(config, file, specifier),
    })),
  };
}
