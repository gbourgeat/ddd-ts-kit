import { addGlossaryRows } from '../check/language/add-glossary-rows.js';
import { CliError } from '../cli-error.js';
import { parseTerms } from './parse-terms.js';
import type { Scope } from './scope.js';

/** Writes the `--term` rows into the glossary of the context. Called once per command, before any name is judged. */
export function learnTerms(scope: Scope): void {
  const rows = parseTerms(scope.flags.term);

  if (rows.length === 0) {
    return;
  }

  const file = `${scope.dir}/CONTEXT.md`;
  const next = addGlossaryRows(scope.ws.read(file) ?? '', rows);

  if (next === undefined) {
    throw new CliError(
      `${file} has no "## Ubiquitous language" table to add the terms to.`,
      'Restore the section with a table whose first column is the term, then run the command again.',
    );
  }

  scope.ws.update(file, next);
}
