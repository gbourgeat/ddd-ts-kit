import { addGlossaryRows, parseGlossary, unknownWords } from '../check/glossary.js';
import { TECHNICAL_WORDS } from '../check/rules/language-no-technical-name.js';
import { CliError } from '../errors.js';
import { assertPastFact, parseConceptName, splitWords, toName, type Name } from '../naming.js';
import type { Scope } from './scope.js';

export interface GlossaryRow {
  readonly term: string;
  readonly meaning: string;
}

export function parseTerms(flags: readonly string[]): GlossaryRow[] {
  return flags.map((flag) => {
    const [term = '', ...meaning] = flag.split('=');
    if (term.trim() === '' || meaning.join('=').trim() === '') {
      throw new CliError(`--term "${flag}" is not a term with its meaning.`, 'Write it as --term "<Term>=<what it means for the business>", for example --term "Invoice=A request for payment sent to a customer".');
    }
    return { term: term.trim(), meaning: meaning.join('=').trim() };
  });
}

/**
 * The name of a concept of the model: normalized, free of technical words, and spoken in the
 * ubiquitous language of the context. The terms given with `--term` join the glossary first.
 */
export function concept(scope: Scope, input: string, role: ConceptRole): Name {
  const name = parseConceptName(input, role.what, { allowName: scope.flags.allowName, strip: role.strip ?? [] });
  if (!scope.flags.allowName) {
    refuseTechnicalWords(name);
    refuseUnknownWords(scope, name);
  }
  return name;
}

export interface ConceptRole {
  readonly what: string;
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
}

/** A name that is not a concept of the model (a port, an outside system): only its form is checked. */
export function label(scope: Scope, input: string, role: ConceptRole): Name {
  return parseConceptName(input, role.what, { allowName: scope.flags.allowName, strip: role.strip ?? [] });
}

export interface EventNames {
  readonly aggregate: Name;
  readonly event: Name;
  readonly eventName: string;
}

export function eventNames(scope: Scope, aggregateInput: string, factInput: string): EventNames {
  const aggregate = concept(scope, aggregateInput, { what: 'aggregate' });
  const fact = concept(scope, factInput, { what: 'fact', strip: ['event'] });
  assertPastFact(fact, scope.flags.allowName);
  return { aggregate, event: toName(`${aggregate.words} ${fact.words}`), eventName: `${scope.context.kebab}.${aggregate.kebab}.${fact.kebab}` };
}

/** Writes the `--term` rows into the glossary of the context. Called once per command, before any name is judged. */
export function learnTerms(scope: Scope): void {
  const rows = parseTerms(scope.flags.term);
  if (rows.length === 0) return;
  const file = `${scope.dir}/CONTEXT.md`;
  const next = addGlossaryRows(scope.ws.read(file) ?? '', rows);
  if (next === undefined) {
    throw new CliError(`${file} has no "## Ubiquitous language" table to add the terms to.`, 'Restore the section with a table whose first column is the term, then run the command again.');
  }
  scope.ws.update(file, next);
}

function refuseTechnicalWords(name: Name): void {
  const technical = splitWords(name.pascal).filter((word) => TECHNICAL_WORDS.includes(word));
  if (technical.length === 0) return;
  throw new CliError(
    `"${name.pascal}" carries the technical word "${technical.join('", "')}".`,
    'Use the noun or verb a domain expert uses for it (rule language/no-technical-name), or pass --allow-name if this really is the business term.',
  );
}

function refuseUnknownWords(scope: Scope, name: Name): void {
  const file = `${scope.dir}/CONTEXT.md`;
  const glossary = parseGlossary(scope.ws.read(file) ?? '');
  const unknown = unknownWords(name.pascal, glossary);
  if (unknown.length === 0) return;
  const known = glossary.terms.length > 0 ? `use an existing term (${glossary.terms.join(', ')})` : 'define the ubiquitous language first';
  const flags = unknown.map((word) => `--term "${toName(word).pascal}=<what it means for the business>"`).join(' ');
  throw new CliError(
    `"${name.pascal}" uses ${unknown.map((word) => `"${word}"`).join(', ')}, which the glossary of ${file} does not define.`,
    `Either ${known}, or add the term in the same command: ${flags}. The glossary is written before the code (rule language/glossary-term).`,
  );
}
