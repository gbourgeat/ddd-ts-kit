import fs from 'node:fs';
import path from 'node:path';
import { parseGlossary, unknownWords, type Glossary } from '../glossary.js';
import type { Rule, SourceFile } from '../types.js';
import { inContext, reporter } from './helpers.js';

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
      if (!namesConcepts(file) || !inContext(file.location)) return [];
      const { context } = file.location;
      const classes = [...file.scan.code.matchAll(CLASS)];
      if (classes.length === 0) return [];
      const glossary = glossaries.of(context);
      const doc = glossaries.docOf(context);
      if (glossary.terms.length === 0) {
        return glossaries.reportsEmptyOnce(context) ? [report({ file: doc, line: glossary.line ?? 1 }, `The context "${context}" has domain classes but its glossary is empty.`, definitionFix(doc))] : [];
      }
      return undefinedNames(file, classes, glossary).map(({ line, name, unknown }) =>
        report({ file: file.path, line }, `${name} uses ${unknown.map((word) => `"${word}"`).join(', ')}, which the glossary of "${context}" does not define.`, `Add the term to the glossary of ${doc} with its meaning, or use the existing term.`),
      );
    });
  },
};

function definitionFix(doc: string): string {
  return `Define the ubiquitous language first: list in the "## Ubiquitous language" table of ${doc} every term the domain experts use, with its meaning, then name the code after it.`;
}

function undefinedNames(file: SourceFile, classes: readonly RegExpExecArray[], glossary: Glossary): { line: number; name: string; unknown: string[] }[] {
  return classes
    .map((match) => ({ line: file.scan.lineAt(match.index), name: match[1] ?? '', unknown: unknownWords(match[1] ?? '', glossary) }))
    .filter(({ unknown }) => unknown.length > 0);
}

/** The glossary of each context, read once, and the contexts already reported as having none. */
class Glossaries {
  readonly #read = new Map<string, Glossary>();
  readonly #reportedEmpty = new Set<string>();

  constructor(
    private readonly root: string,
    private readonly contextsDir: string,
  ) {}

  docOf(context: string): string {
    return `${this.contextsDir}/${context}/CONTEXT.md`;
  }

  of(context: string): Glossary {
    const known = this.#read.get(context);
    if (known !== undefined) return known;
    const glossary = parseGlossary(this.#text(context));
    this.#read.set(context, glossary);
    return glossary;
  }

  /** True the first time only: an empty glossary is one finding, not one per class. */
  reportsEmptyOnce(context: string): boolean {
    if (this.#reportedEmpty.has(context)) return false;
    this.#reportedEmpty.add(context);
    return true;
  }

  #text(context: string): string {
    try {
      return fs.readFileSync(path.join(this.root, this.docOf(context)), 'utf8');
    } catch {
      // A missing CONTEXT.md is reported by tree/context-doc; here it is an empty glossary.
      return '';
    }
  }
}

/** The files whose classes are concepts of the model: the building blocks and the use case messages. */
function namesConcepts(file: SourceFile): boolean {
  if (!inContext(file.location) || file.isTest) return false;
  const { layer, inside } = file.location;
  if (layer === 'domain') return DOMAIN_ROLES.has(inside[0] ?? '');
  return layer === 'application' && (inside[0] === 'commands' || inside[0] === 'queries') && /\.(?:command|query)\.ts$/.test(file.path);
}
