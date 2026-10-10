import { Glossaries } from '../language/glossaries.js';
import type { Glossary } from '../language/parse-glossary.js';
import { unknownWords } from '../language/unknown-words.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

const CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*)/g;
const DOMAIN_ROLES = new Set(['aggregates', 'entities', 'value-objects', 'services', 'events']);

export const languageGlossaryTerm: Rule = {
  id: 'language/glossary-term',
  description:
    "Every aggregate, entity, value object, domain service, domain event, command and query is named with terms of the Ubiquitous language table of its context's CONTEXT.md.",
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const glossaries = new Glossaries(project.root, project.config.contextsDir);

    return project.files.flatMap((file) => {
      const context = conceptsContext(file);
      const classes = context === undefined ? [] : [...file.scan.code.matchAll(CLASS)];

      if (context === undefined || classes.length === 0) {
        return [];
      }

      const glossary = glossaries.of(context);
      const doc = glossaries.docOf(context);

      if (glossary.terms.length > 0) {
        return toViolations(report, file.path, undefinedNames(file, classes, { glossary, context, doc }));
      }

      if (!glossaries.reportsEmptyOnce(context)) {
        return [];
      }

      return [
        report(
          { file: doc, line: glossary.line ?? 1 },
          `The context "${context}" has domain classes but its glossary is empty.`,
          definitionFix(doc),
        ),
      ];
    });
  },
};

interface Language {
  readonly glossary: Glossary;
  readonly context: string;
  /** The CONTEXT.md that holds the glossary. */
  readonly doc: string;
}

function definitionFix(doc: string): string {
  return `Define the ubiquitous language first: list in the "## Ubiquitous language" table of ${doc} every term the domain experts use, with its meaning, then name the code after it.`;
}

function undefinedNames(
  file: SourceFile,
  classes: readonly RegExpExecArray[],
  { glossary, context, doc }: Language,
): Finding[] {
  return classes.flatMap((match) => {
    const name = match[1] ?? '';
    const unknown = unknownWords(name, glossary);

    if (unknown.length === 0) {
      return [];
    }

    const words = unknown.map((word) => `"${word}"`).join(', ');
    const fix = `Add the term to the glossary of ${doc} with its meaning, or use the existing term.`;

    return [
      {
        line: file.scan.lineAt(match.index),
        message: `${name} uses ${words}, which the glossary of "${context}" does not define.`,
        fix,
      },
    ];
  });
}

/** The context of a file whose classes are concepts of the model: the building blocks and the use case messages. */
function conceptsContext(file: SourceFile): string | undefined {
  if (!inContext(file.location) || file.isTest) {
    return undefined;
  }

  const { context, layer, inside } = file.location;
  const [folder = ''] = inside;

  const isMessage =
    layer === 'application' &&
    (folder === 'commands' || folder === 'queries') &&
    /\.(?:command|query)\.ts$/.test(file.path);

  return (layer === 'domain' && DOMAIN_ROLES.has(folder)) || isMessage ? context : undefined;
}
