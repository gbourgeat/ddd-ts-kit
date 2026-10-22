import type { SourceFile } from '../model/source-file';
import type { Scan } from '../scan/scan';
import { callArguments } from '../text/call-arguments';
import { escapeRegExp } from '../text/escape-reg-exp';
import { identifier } from '../text/identifier';
import type { ListPart } from '../text/list-part';

const ON = /\.\s*on\s*\(/g;
const PHASE_KEY = /(?<![\w$.])phase\s*:\s*$/;
const AFTER_COMMIT = 'after-commit';

/**
 * True when the module file registers the handler, and every `.on(name, callback, options)` whose
 * callback mentions it (the class, or a variable holding `new <Class>(..)`) writes
 * `phase: 'after-commit'` in its options. A handler the module does not register runs before the commit.
 */
export function isRegisteredAfterCommit(module: SourceFile | undefined, className: string): boolean {
  if (module === undefined) {
    return false;
  }

  const { code } = module.scan;
  const mentions = [className, ...variablesHolding(code, className)].map(identifier);
  const calls = [...code.matchAll(ON)].map((match) => callArguments(code, match.index + match[0].length - 1));

  const registrations = calls.filter(
    ([, callback]) => callback !== undefined && mentions.some((mention) => mention.test(callback.code)),
  );

  return registrations.length > 0 && registrations.every(([, , options]) => saysAfterCommit(module.scan, options));
}

function variablesHolding(code: string, className: string): string[] {
  const held = new RegExp(
    `(?<![\\w$.])(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=[^;=]*?(?<![\\w$])new\\s+${escapeRegExp(className)}(?![\\w$])`,
    'g',
  );

  return [...code.matchAll(held)].flatMap((match) => match[1] ?? []);
}

function saysAfterCommit(scan: Scan, options: ListPart | undefined): boolean {
  if (options === undefined) {
    return false;
  }

  const end = options.start + options.code.length;

  const within = scan.strings.filter(
    (literal) => literal.value === AFTER_COMMIT && literal.start >= options.start && literal.start < end,
  );

  return within.some((literal) => PHASE_KEY.test(scan.code.slice(options.start, literal.start)));
}
