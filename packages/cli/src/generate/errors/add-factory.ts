import { scan } from '../../check/scan/scan';
import { classBody, type ClassBody } from './class-body';
import { staticMethods } from './static-methods';

export interface FactoryAddition {
  readonly className: string;
  readonly name: string;
  /** The method, indented as a member, without the blank lines around it. */
  readonly text: string;
}

/**
 * The source of an error class with one more static factory, after the last one it has, so
 * that the factories stay together above the other members. Undefined when the class is not
 * found; the source itself when a static method of that name is already there.
 */
export function addFactory(source: string, addition: FactoryAddition): string | undefined {
  const scanned = scan(source);
  const body = classBody(scanned, addition.className);

  if (body === undefined) {
    return undefined;
  }

  const methods = staticMethods(scanned.code, body);

  if (methods.some((method) => method.name === addition.name)) {
    return source;
  }

  const last = methods.at(-1);

  if (last === undefined) {
    return `${source.slice(0, body.open + 1)}\n${addition.text}\n${afterOpening(source, body)}`;
  }

  return `${source.slice(0, last.end + 1)}\n\n${addition.text}${source.slice(last.end + 1)}`;
}

/** An empty class closes on the line of its opening brace; one with members keeps a blank line before the first. */
function afterOpening(source: string, body: ClassBody): string {
  const rest = source.slice(body.open + 1);

  return source.slice(body.open + 1, body.close).trim() === '' ? rest.trimStart() : rest;
}
