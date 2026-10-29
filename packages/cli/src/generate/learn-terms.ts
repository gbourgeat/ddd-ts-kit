import { addGlossaryRows } from '../check/language/add-glossary-rows';
import { CliError } from '../cli-error';
import { renderTemplate } from '../templating';
import { parseTerms } from './parse-terms';
import type { Scope } from './scope';
import { isSharedKernel } from './is-shared-kernel';
import { withoutLanguageTodo } from './without-language-todo';

/**
 * Writes the `--term` rows into the glossary of the context, and takes away the marker that asked
 * for the first term. Called once per command, before any name is judged.
 */
export function learnTerms(scope: Scope): void {
  const rows = parseTerms(scope.flags.term);

  if (rows.length === 0) {
    return;
  }

  const file = `${scope.dir}/CONTEXT.md`;
  const next = addGlossaryRows(scope.ws.read(file) ?? startingDoc(scope), rows);

  if (next === undefined) {
    throw new CliError(
      `${file} has no "## Ubiquitous language" table to add the terms to.`,
      'Restore the section with a table whose first column is the term, then run the command again.',
    );
  }

  scope.ws.update(file, withoutLanguageTodo(next));
}

/** The glossary of the shared kernel starts with its first term: a context has its CONTEXT.md from `generate context`. */
function startingDoc(scope: Scope): string {
  return isSharedKernel(scope) ? renderTemplate('shared-kernel/CONTEXT.md.tpl', {}) : '';
}
