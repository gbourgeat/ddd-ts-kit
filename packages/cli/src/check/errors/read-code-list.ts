import { wholeLiteral } from '../declarations/whole-literal.js';
import type { Scan } from '../scan/scan.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { splitTopLevel } from '../text/split-top-level.js';
import type { CodeEntry } from './code-entry.js';
import type { CodeList } from './code-list.js';

const KEY = /^([A-Za-z_$][\w$]*)\s*:\s*/;

/** The object `name` a source declares as its code list, with its entries; undefined when it declares none. */
export function readCodeList(scan: Scan, name: string): CodeList | undefined {
  const declaration = new RegExp(`(?<![\\w$.])const\\s+${escapeRegExp(name)}\\s*(?::[^=;]*)?=\\s*\\{`).exec(scan.code);

  if (declaration === null) {
    return undefined;
  }

  const open = declaration.index + declaration[0].length - 1;
  const close = matchingBracket(scan.code, open);

  return {
    name,
    line: scan.lineAt(declaration.index),
    constant: /^\s*as\s+const\b/.test(scan.code.slice(close + 1)),
    entries: entriesOf(scan, open, close),
  };
}

function entriesOf(scan: Scan, open: number, close: number): CodeEntry[] {
  return splitTopLevel(scan.code.slice(open + 1, close)).flatMap((part) => {
    const key = KEY.exec(part.code);

    if (key === null) {
      return [];
    }

    const start = open + 1 + part.start;
    const value = { code: part.code.slice(key[0].length), start: start + key[0].length };

    return [{ key: key[1] ?? '', code: wholeLiteral(scan, value), line: scan.lineAt(start) }];
  });
}
