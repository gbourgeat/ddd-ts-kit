import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

export const contextDeclaredRelationship: Rule = {
  id: 'context/declared-relationship',
  description:
    'Importing the published language of another context requires the relationship to be declared in the config.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!inContext(file.location)) {
        return [];
      }

      const here = file.location.context;
      const upstreams = project.config.contexts[here]?.upstreams.map((upstream) => upstream.context) ?? [];

      return importedLanguages(file, here)
        .filter(({ context }) => !upstreams.includes(context))
        .map(({ context: there, line }) => ({
          line,
          message: `"${here}" depends on "${there}" but the relationship is not declared.`,
          fix: `Add { "context": "${there}", "relationship": "published-language" } to contexts.${here}.upstreams in ddd-ts-kit.config.json, after checking that the dependency direction is intended.`,
        }));
    });
  },
};

/** The published languages of other contexts that the file imports. */
function importedLanguages(file: SourceFile, here: string): { context: string; line: number }[] {
  return file.imports.flatMap(({ target, line }) => {
    if (target.kind !== 'file' || !inContext(target.location)) {
      return [];
    }

    const there = target.location;

    return there.context === here || there.layer !== 'published-language' ? [] : [{ context: there.context, line }];
  });
}
