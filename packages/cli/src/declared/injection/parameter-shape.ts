import { matchingBracket } from '../../check/text/matching-bracket';

/** A constructor parameter, read as text: its name, the type it is annotated with, and what makes it more than that. */
export interface ParameterShape {
  readonly name: string;
  /** The annotation, trimmed; undefined when the parameter has none. */
  readonly type: string | undefined;
  /** What keeps the parameter from naming one dependency: a rest, a destructuring, a `?` or a default value. */
  readonly oddity: string | undefined;
}

const DECORATOR = /^@[\w$.]+\s*/;
const MODIFIERS = /^(?:(?:public|private|protected|readonly|override)\s+)*/;
const NAME = /^([A-Za-z_$][\w$]*)\s*(\?)?\s*(?::([\s\S]*))?$/;

/** Reads `private readonly clock: Clock`, whatever decorators and modifiers come first. */
export function parameterShape(parameter: string): ParameterShape {
  const text = withoutDecorators(parameter.trim()).replace(MODIFIERS, '');
  const unnamed = unnamedShape(text);

  if (unnamed !== undefined) {
    return unnamed;
  }

  const assigned = defaultAt(text);
  const [, name = text, optional, type] = NAME.exec(assigned === -1 ? text : text.slice(0, assigned).trim()) ?? [];

  return { name, type: type?.trim(), oddity: oddityOf(optional !== undefined, assigned !== -1) };
}

/** A rest parameter or a destructuring: neither is one named value typed by one class. */
function unnamedShape(text: string): ParameterShape | undefined {
  if (text.startsWith('...')) {
    const [name = ''] = text.replace(/^\.\.\.\s*/, '').split(/[\s:]/);

    return { name, type: undefined, oddity: 'is a rest parameter' };
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    return { name: text.split(':')[0]?.trim() ?? text, type: undefined, oddity: 'is destructured' };
  }

  return undefined;
}

function oddityOf(optional: boolean, defaulted: boolean): string | undefined {
  if (defaulted) {
    return 'has a default value';
  }

  return optional ? 'is optional' : undefined;
}

function withoutDecorators(text: string): string {
  let rest = text;

  for (let name = DECORATOR.exec(rest); name !== null; name = DECORATOR.exec(rest)) {
    const called = rest.charAt(name[0].length) === '(';

    rest = rest.slice(called ? matchingBracket(rest, name[0].length) + 1 : name[0].length).trimStart();
  }

  return rest;
}

/** Offset of the `=` that gives the parameter a default value, or -1: the `=` of `=>`, `==`, `<=` and `>=` are not one. */
function defaultAt(text: string): number {
  let depth = 0;

  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);

    if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      depth -= 1;
    } else if (char === '=' && depth === 0 && text.charAt(at + 1) !== '>' && !'=!<>'.includes(text.charAt(at - 1))) {
      return at;
    }
  }

  return -1;
}
