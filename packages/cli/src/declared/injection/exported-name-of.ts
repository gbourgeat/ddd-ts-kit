import type { SourceFile } from '../../check/model/source-file';

const NAMED_IMPORTS = /(?<![\w$.])import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}/g;

/** The name a class is exported under by the module `file` imports it from: `Clock` for `import { Clock as Time }`. */
export function exportedNameOf(file: SourceFile, local: string): string {
  for (const [, names = ''] of file.scan.code.matchAll(NAMED_IMPORTS)) {
    for (const binding of names.split(',')) {
      const [exported, renamed] = binding
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);

      if (renamed === local && exported !== undefined) {
        return exported;
      }
    }
  }

  return local;
}
