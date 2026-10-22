import type { Rule } from '../model/rule';
import { inContext } from '../support/in-context';
import { perFile } from '../support/per-file';

export const contextPublishedLanguageOnly: Rule = {
  id: 'context/published-language-only',
  description: "A file imports from another context only through that context's published-language/.",
  scope: 'file',
  run(project) {
    const { contextsDir } = project.config;

    return perFile(project, this.id, (file) => {
      const here = file.location;

      if (!inContext(here)) {
        return [];
      }

      return file.imports.flatMap(({ target, line }) => {
        if (target.kind !== 'file' || !inContext(target.location)) {
          return [];
        }

        const there = target.location;

        if (there.context === here.context || there.layer === 'published-language') {
          return [];
        }

        const fix = `Import from ${contextsDir}/${there.context}/published-language only; if the type is missing there, publish it with \`ddd-ts-kit generate integration-event ${there.context} <Aggregate> <Fact>\` or react to an integration event.`;

        return [
          { line, message: `"${here.context}" imports the internals of "${there.context}" (${target.path}).`, fix },
        ];
      });
    });
  },
};
