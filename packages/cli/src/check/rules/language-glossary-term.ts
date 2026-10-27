import { Glossaries } from '../language/glossaries';
import type { Glossary } from '../language/parse-glossary';
import { REFUSAL_QUALIFIERS } from '../language/refusal-qualifiers';
import { unknownWords } from '../language/unknown-words';
import { buildsThroughFactories } from '../errors/builds-through-factories';
import { refusalClasses } from '../errors/refusal-classes';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inContext } from '../support/in-context';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

const CLASS = /(?<![\w$.])class\s+([A-Za-z_$][\w$]*)/g;
const DOMAIN_ROLES = new Set(['aggregates', 'entities', 'value-objects', 'services', 'events']);

export const languageGlossaryTerm: Rule = {
  id: 'language/glossary-term',
  description:
    'Every aggregate, entity, value object, domain service, domain event, command and query is named with terms of the Ubiquitous language table of its context\'s CONTEXT.md, and under "stack.refusals": "factories" or "named" every class of domain/errors/ too; a value object (*.vo.ts) of the shared kernel, and its refusals (*.error.ts) likewise, with the terms of <sharedKernelDir>/CONTEXT.md. A refusal class (under "named", one that extends DomainRefusal) may also use the qualifiers invalid, unknown, already, too, no, missing and required; <context>.codes.ts holds no class and is not judged.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const glossaries = new Glossaries(project.root, project.config.contextsDir);
    const roles = buildsThroughFactories(project) ? new Set([...DOMAIN_ROLES, 'errors']) : DOMAIN_ROLES;
    const { sharedKernelDir } = project.config;

    return project.files.flatMap((file) => {
      const owner = conceptsOwner(file, { roles, glossaries, sharedKernelDir });
      const classes = owner === undefined ? [] : [...file.scan.code.matchAll(CLASS)];

      if (owner === undefined || classes.length === 0) {
        return [];
      }

      const glossary = glossaries.at(owner.doc);

      if (glossary.terms.length > 0) {
        return toViolations(report, file.path, undefinedNames(file, classes, { glossary, owner }));
      }

      if (!glossaries.reportsEmptyOnce(owner.doc)) {
        return [];
      }

      return [
        report(
          { file: owner.doc, line: glossary.line ?? 1 },
          `${owner.subject} has domain classes but its glossary is empty.`,
          definitionFix(owner.doc),
        ),
      ];
    });
  },
};

/** Whose glossary names the classes of a file: a context, or the shared kernel. */
interface Owner {
  /** The CONTEXT.md that holds the glossary. */
  readonly doc: string;
  /** How a message names its glossary: `"billing"`, `the shared kernel`. */
  readonly of: string;
  /** How a message starts with it: `The context "billing"`, `The shared kernel`. */
  readonly subject: string;
}

interface Judged {
  readonly roles: ReadonlySet<string>;
  readonly glossaries: Glossaries;
  readonly sharedKernelDir: string;
}

interface Language {
  readonly glossary: Glossary;
  readonly owner: Owner;
}

function definitionFix(doc: string): string {
  return `Define the ubiquitous language first: list in the "## Ubiquitous language" table of ${doc} every term the domain experts use, with its meaning, then name the code after it.`;
}

function undefinedNames(
  file: SourceFile,
  classes: readonly RegExpExecArray[],
  { glossary, owner }: Language,
): Finding[] {
  const refusals = new Set(refusalClasses(file.scan).map((shape) => shape.name));

  return classes.flatMap((match) => {
    const name = match[1] ?? '';
    const unknown = unknownWords(name, glossary, refusals.has(name) ? REFUSAL_QUALIFIERS : []);

    if (unknown.length === 0) {
      return [];
    }

    const words = unknown.map((word) => `"${word}"`).join(', ');
    const fix = `Add the term to the glossary of ${owner.doc} with its meaning, or use the existing term.`;

    return [
      {
        line: file.scan.lineAt(match.index),
        message: `${name} uses ${words}, which the glossary of ${owner.of} does not define.`,
        fix,
      },
    ];
  });
}

/**
 * Whose glossary names the classes of a file that are concepts of the model: in a context, the
 * building blocks, the use case messages and, once the project builds its refusals through
 * factories, the error classes, named after a concept (`factories`) or after a refusal (`named`);
 * in the shared kernel, outside `presentation/`, its value objects and, likewise, its refusals.
 */
function conceptsOwner(file: SourceFile, { roles, glossaries, sharedKernelDir }: Judged): Owner | undefined {
  if (file.isTest) {
    return undefined;
  }

  if (file.location.area === 'shared-kernel') {
    return isSharedConcept(file.path, roles, sharedKernelDir)
      ? { doc: `${sharedKernelDir}/CONTEXT.md`, of: 'the shared kernel', subject: 'The shared kernel' }
      : undefined;
  }

  return contextOwner(file, roles, glossaries);
}

function contextOwner(file: SourceFile, roles: ReadonlySet<string>, glossaries: Glossaries): Owner | undefined {
  if (!inContext(file.location)) {
    return undefined;
  }

  const { context, layer, inside } = file.location;
  const [folder = ''] = inside;

  const isMessage =
    layer === 'application' &&
    (folder === 'commands' || folder === 'queries') &&
    /\.(?:command|query)\.ts$/.test(file.path);

  return (layer === 'domain' && roles.has(folder)) || isMessage
    ? { doc: glossaries.docOf(context), of: `"${context}"`, subject: `The context "${context}"` }
    : undefined;
}

function isSharedConcept(file: string, roles: ReadonlySet<string>, sharedKernelDir: string): boolean {
  if (file.startsWith(`${sharedKernelDir}/presentation/`)) {
    return false;
  }

  return file.endsWith('.vo.ts') || (roles.has('errors') && file.endsWith('.error.ts'));
}
