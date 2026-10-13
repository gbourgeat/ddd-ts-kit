import { genericWordsOf } from '../business-names/generic-words-of.js';
import { judgesNames } from '../business-names/judges-names.js';
import type { NamedBinding } from '../business-names/named-binding.js';
import { namedBindings } from '../business-names/named-bindings.js';
import { suggestedName } from '../business-names/suggested-name.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';

const WHY =
  'the code of the model speaks the ubiquitous language of its context, and a generic word hides which concept the value is';

export const namingBusinessName: Rule = {
  id: 'naming/business-name',
  description:
    'A variable, parameter, property, destructured or loop binding of domain/ and application/ (and of the shared kernel) is named after the concept it holds, never a generic word such as target, data or item.',
  scope: 'file',
  run(project) {
    const words = genericWordsOf(project.config);

    return perFile(project, this.id, (file) => {
      if (words.size === 0 || !judgesNames(file, project.config.sharedKernelDir)) {
        return [];
      }

      return namedBindings(file.scan.code)
        .filter((binding) => words.has(binding.name))
        .map((binding) => finding(file, binding));
    });
  },
};

function finding(file: SourceFile, binding: NamedBinding): Finding {
  const suggestion = suggestedName(binding);

  return {
    line: file.scan.lineAt(binding.offset),
    message: `The ${binding.kind} "${binding.name}" is named with a generic word.`,
    fix: `${rename(binding, suggestion)}: ${WHY}. \`npx eslint --fix\` renames a variable built by X.create(..) or new X(..), or read from a repository, with every use of it.`,
  };
}

function rename(binding: NamedBinding, suggestion: string | undefined): string {
  if (suggestion !== undefined) {
    return `Rename it ${suggestion}, the name the code already gives to what it holds`;
  }

  const collection = binding.source ?? '';

  if (binding.kind === 'loop variable') {
    return `Rename it after one element of ${collection === '' ? 'the collection' : collection}, in the singular (for (const reminder of dueReminders))`;
  }

  return 'Rename it after the concept it holds, a term of the glossary of the context (CONTEXT.md)';
}
