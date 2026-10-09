import { CliError } from './errors.js';

export interface Name {
  readonly pascal: string;
  readonly camel: string;
  readonly kebab: string;
  readonly constant: string;
  readonly words: string;
  readonly title: string;
  /** `a` or `an`, for builder factories such as `anInvoice()`. */
  readonly article: string;
  /** Plural in snake_case and camelCase, for table names: `purchase_orders`, `purchaseOrders`. */
  readonly table: string;
  readonly tableCamel: string;
}

export function splitWords(input: string): string[] {
  return input
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

export function toName(input: string): Name {
  const words = splitWords(input);
  const pascal = words.map(capitalize).join('');
  const plural = [...words.slice(0, -1), pluralize(words.at(-1) ?? '')];
  return {
    pascal,
    camel: pascal.charAt(0).toLowerCase() + pascal.slice(1),
    kebab: words.join('-'),
    constant: words.join('_').toUpperCase(),
    words: words.join(' '),
    title: capitalize(words.join(' ')),
    article: /^[aeiou]/.test(words[0] ?? '') ? 'an' : 'a',
    table: plural.join('_'),
    tableCamel: plural.map((word, index) => (index === 0 ? word : capitalize(word))).join(''),
  };
}

function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return /(?:s|x|z|ch|sh)$/.test(word) ? `${word}es` : `${word}s`;
}

const VAGUE_SUFFIXES = ['manager', 'helper', 'util', 'utils', 'data', 'info'];

export interface NameOptions {
  readonly allowName: boolean;
  /** Role suffixes the generator adds itself, removed when the caller typed them. */
  readonly strip?: readonly string[];
}

export function parseConceptName(input: string, what: string, options: NameOptions): Name {
  if (!/^[A-Za-z][A-Za-z0-9_\- ]*$/.test(input)) {
    throw new CliError(
      `"${input}" is not a valid ${what} name.`,
      'Use letters and digits only, starting with a letter, for example InvoiceLine or invoice-line.',
    );
  }
  let words = splitWords(input);
  const last = words.at(-1);
  if (options.strip !== undefined && words.length > 1 && last !== undefined && options.strip.includes(last)) {
    words = words.slice(0, -1);
  }
  const tail = words.at(-1);
  if (!options.allowName && tail !== undefined && VAGUE_SUFFIXES.includes(tail)) {
    throw new CliError(
      `"${input}" ends with "${capitalize(tail)}", which names a technical bucket, not a concept.`,
      'Use a term of the ubiquitous language (what a domain expert would call it), or pass --allow-name if this really is the business term.',
    );
  }
  return toName(words.join(' '));
}

export function parseContextName(input: string): Name {
  const name = toName(input);
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name.kebab)) {
    throw new CliError(
      `"${input}" is not a valid context name.`,
      'Name the bounded context in kebab-case after the business capability, for example billing or order-fulfilment.',
    );
  }
  return name;
}

const IRREGULAR_PAST = new Set([
  'awoken', 'become', 'became', 'begun', 'bought', 'bound', 'broken', 'brought', 'built', 'chosen', 'cut', 'dealt',
  'done', 'drawn', 'fallen', 'fed', 'forgotten', 'found', 'frozen', 'given', 'gone', 'grown', 'heard', 'held',
  'hidden', 'hit', 'kept', 'known', 'laid', 'led', 'left', 'lent', 'lost', 'made', 'meant', 'met', 'overdue',
  'paid', 'put', 'quit', 'read', 'risen', 'run', 'said', 'seen', 'sent', 'set', 'shown', 'shut', 'sold', 'spent',
  'split', 'stolen', 'sworn', 'taken', 'taught', 'told', 'thrown', 'understood', 'withdrawn', 'won', 'written',
]);

/** Pragmatic: one word of the fact has to look like a past participle. Not a grammar. */
export function looksLikePastFact(fact: Name): boolean {
  return fact.kebab.split('-').some((word) => /[a-z]{2,}ed$/.test(word) || IRREGULAR_PAST.has(word));
}

export function assertPastFact(fact: Name, allowName: boolean): void {
  if (allowName || looksLikePastFact(fact)) return;
  throw new CliError(
    `"${fact.pascal}" does not read as something that happened.`,
    'Name the event as a fact in the past tense (Issued, Paid, MarkedAsOverdue), or pass --allow-name if the term is right.',
  );
}

export function eventName(context: Name, aggregate: Name, fact: Name): string {
  return `${context.kebab}.${aggregate.kebab}.${fact.kebab}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
