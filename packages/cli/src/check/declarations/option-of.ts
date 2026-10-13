import type { Scan } from '../scan/scan.js';
import type { Decoration } from './decoration.js';

/** What an option of a decorator holds. */
export interface OptionValue {
  /** Undefined when the value is a variable, a template with substitutions, a concatenation or a shorthand. */
  readonly literal: string | undefined;
  /** The value when it reads a member of a name, `InvoiceIssued.eventName`; undefined otherwise. */
  readonly reference?: string;
  readonly line: number;
}

const MEMBER = /^\s*([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\s*[,}]/;

/** The value of `key` in an options object given directly to the decorator, or undefined when no such key is written. */
export function optionOf(scan: Scan, decoration: Decoration, key: string): OptionValue | undefined {
  const { code } = scan;
  const pattern = new RegExp(`(?<![\\w$.])${key}\\s*(?::\\s*|(?=[,}]))`, 'g');

  pattern.lastIndex = decoration.open;

  for (let match = pattern.exec(code); match !== null && match.index < decoration.close; match = pattern.exec(code)) {
    if (!isDirectOption(code.slice(decoration.open + 1, match.index))) {
      continue;
    }

    const valueStart = match.index + match[0].length;
    const literal = scan.strings.find((candidate) => candidate.start === valueStart);
    const complete = literal !== undefined && /^\s*[,}]/.test(code.slice(literal.end, decoration.close + 1));

    const reference = MEMBER.exec(code.slice(valueStart, decoration.close + 1))?.[1];

    return {
      literal: complete ? literal.value : undefined,
      line: scan.lineAt(match.index),
      ...(reference === undefined ? {} : { reference }),
    };
  }

  return undefined;
}

/** True one brace deep and inside no call or list: the keys of an object passed as an argument. */
function isDirectOption(before: string): boolean {
  const net = (open: string, close: string): number => before.split(open).length - before.split(close).length;

  return net('{', '}') === 1 && net('(', ')') === 0 && net('[', ']') === 0;
}
