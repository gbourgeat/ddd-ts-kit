import { plural, singular, toName, type Name } from '../naming/index.js';

/** What one line and the lines of a search are named in the generated code. */
export interface SearchedElements {
  readonly element: string;
  readonly elements: string;
}

/** Names the templates of a search already give to something else, and the reserved words of the language. */
const TAKEN = new Set([
  'page',
  'scope',
  'visible',
  'start',
  'last',
  'id',
  'cursor',
  'left',
  'right',
  'toward',
  'field',
  'value',
  'reader',
  'query',
  'queries',
  'request',
  'input',
  'line',
  'new',
  'delete',
  'class',
  'function',
  'default',
  'case',
  'in',
  'of',
  'this',
  'void',
  'with',
  'do',
  'if',
  'for',
  'return',
  'switch',
  'interface',
  'package',
  'static',
  'let',
  'yield',
  'await',
]);

/**
 * The business words of a search, for the bindings that hold its lines: `invoice` and `invoices`
 * for `SearchInvoices`, never `item` and `items`. A name the template already uses is prefixed:
 * `foundPage`, `foundPages`.
 */
export function searchedElements(name: Name): SearchedElements {
  const words = name.words.split(' ');
  const things = words[0] === 'search' && words.length > 1 ? words.slice(1) : words;
  const last = things.at(-1) ?? '';
  const one = singular(last);
  const lead = things.slice(0, -1);
  const element = toName([...lead, one ?? last].join(' ')).camel;
  const elements = toName([...lead, one === undefined ? plural(last) : last].join(' ')).camel;

  if (TAKEN.has(element) || TAKEN.has(elements)) {
    return { element: `found${toName(element).pascal}`, elements: `found${toName(elements).pascal}` };
  }

  return { element, elements };
}
