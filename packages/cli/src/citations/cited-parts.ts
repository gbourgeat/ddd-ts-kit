import fs from 'node:fs';
import path from 'node:path';
import { parseGlossary } from '../check/language/parse-glossary';
import type { Config } from '../config';
import type { Slice } from '../progress/slice';
import type { CitedName } from './cited-name';
import { citedNames } from './cited-names';
import type { DocumentPart } from './document-part';

/** A part of a design with the contexts it is read in and the names it cites. */
export interface CitedPart {
  readonly part: DocumentPart;
  /** The contexts of its rows; every declared context when a row names another or the part has no row. */
  readonly contexts: readonly string[];
  readonly names: readonly CitedName[];
}

/** The project a design belongs to. */
export interface DesignedProject {
  readonly root: string;
  readonly config: Config;
}

/** Each part with the names it cites, read against the glossary of its contexts. */
export function citedParts(
  parts: readonly DocumentPart[],
  slices: readonly Slice[],
  project: DesignedProject,
): CitedPart[] {
  const glossaries = new Map<string, readonly string[]>();

  const termsOf = (context: string): readonly string[] => {
    const known = glossaries.get(context) ?? glossaryOf(project, context);

    glossaries.set(context, known);

    return known;
  };

  return parts.map((part) => {
    const contexts = contextsOf(part, slices, project.config);
    const terms = new Set(contexts.flatMap(termsOf));

    return { part, contexts, names: citedNames(part, { sourceRoot: project.config.sourceRoot, terms }) };
  });
}

function contextsOf(part: DocumentPart, slices: readonly Slice[], config: Config): string[] {
  const declared = Object.keys(config.contexts);
  const named = part.rows.map((id) => slices.find((row) => row.id === id)?.context ?? '');

  return named.length > 0 && named.every((context) => declared.includes(context)) ? [...new Set(named)] : declared;
}

/** The terms of the glossary of a context, in lower case without spaces. */
function glossaryOf({ root, config }: DesignedProject, context: string): string[] {
  const file = path.join(root, config.contextsDir, context, 'CONTEXT.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';

  return parseGlossary(text).terms.map((term) => term.toLowerCase().replace(/\s+/g, ''));
}
