import type { TSESLint } from '@typescript-eslint/utils';
import type { LintedFile } from '../../project/linted-file';
import { importListener, type ImportedName } from '../imports/import-listener';

/** Hands each name among `wanted` that the file imports from `@ddd-ts-kit/kernel`, any entry. */
export function kernelNamesListener(
  file: LintedFile,
  wanted: ReadonlySet<string>,
  visit: (imported: ImportedName) => void,
): TSESLint.RuleListener {
  return importListener(file, ({ target, names }) => {
    if (target.kind === 'package' && target.name.startsWith('@ddd-ts-kit/kernel')) {
      names.filter(({ name }) => wanted.has(name)).forEach(visit);
    }
  });
}
