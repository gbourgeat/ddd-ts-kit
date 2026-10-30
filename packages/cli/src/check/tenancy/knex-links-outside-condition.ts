import type { SourceFile } from '../model/source-file';
import { balancedArguments } from './balanced-arguments';
import { chainLinks, type ChainLink } from './chain-links';
import { endOfEnclosing } from './end-of-enclosing';
import { isOrLink } from './is-or-link';
import { rawSqlText } from './raw-sql-text';

const HELPERS = ['tenantTable', 'ownTenantTable', 'whereTenant'];
const NAME = '[A-Za-z_$][\\w$]*';

/** A method or a function of the file that answers a builder of the helpers. */
const ANSWERS_BUILDER = new RegExp(
  `(${NAME})\\s*\\([^()]*\\)\\s*(?::[^{;]*)?\\{\\s*return\\s+(?:${HELPERS.join('|')})(?![\\w$])`,
  'g',
);

const DECLARED = new RegExp(`(?:const|let)\\s+(${NAME})\\s*(?::[^=;]*)?=\\s*`, 'g');
const GIVEN_TO_HELPER = new RegExp(`(?<![\\w$])whereTenant\\s*(?:<[^()]*>\\s*)?\\(\\s*(${NAME})\\s*,`, 'g');
const CALLBACK = new RegExp(`^\\s*(?:async\\s+)?\\(?\\s*(${NAME})\\s*(?::[^()]*)?\\)?\\s*=>`);

/** A local that holds a builder of the helpers, and how far it lives. */
interface BuilderLocal {
  readonly name: string;
  readonly from: number;
  readonly to: number;
}

/**
 * The links of a Knex adapter that leave the tenant condition of a statement of the helpers: an
 * `or` at its top, or what clears its conditions; on the chain of a helper, of what a function of
 * the file answers, of a local that holds one of them, and in the builder given to `whereTenant`.
 * In SQL `and` binds first, so such an `or` is outside the condition. The callback of a `where`
 * is a group, and what it holds is left out; a `modify` is no group.
 */
export function knexLinksOutsideCondition(file: SourceFile): readonly ChainLink[] {
  const { code } = file.scan;
  const answered = [...code.matchAll(ANSWERS_BUILDER)].map(([, name = '']) => escaped(name));
  const source = `(?<![\\w$])(?:${[...HELPERS, ...answered].join('|')})\\s*(?:<[^()]*>\\s*)?\\(`;
  const calls = [...code.matchAll(new RegExp(source, 'g'))].flatMap((match) => chainsOfCall(code, match));

  const locals = builderLocals(code, new RegExp(`(?:this\\s*\\.\\s*)?${source}`, 'y')).flatMap((local) => [
    chainOfExpression(code, local.from),
    ...uses(code, local),
  ]);

  const links = [...calls, ...locals].flatMap((chain) => linksOutside(file, chain));

  return [...new Map(links.map((link) => [link.offset, link])).values()];
}

function chainsOfCall(code: string, match: RegExpExecArray): readonly (readonly ChainLink[])[] {
  const open = match.index + match[0].length - 1;
  const after = chainLinks(code, open + balancedArguments(code, open).length + 2);

  return match[0].startsWith('whereTenant') ? [after, chainOfExpression(code, open + 1)] : [after];
}

/** The chain of an expression, from the first dot outside its brackets: `rows.where(a).orWhere(b)`. */
function chainOfExpression(code: string, from: number): readonly ChainLink[] {
  const stop = endOfEnclosing(code, from, '.,;');

  return code.charAt(stop) === '.' ? chainLinks(code, stop) : [];
}

function builderLocals(code: string, startsBuilder: RegExp): readonly BuilderLocal[] {
  const given = [...code.matchAll(GIVEN_TO_HELPER)];
  const locals: BuilderLocal[] = [];

  for (const match of code.matchAll(DECLARED)) {
    const name = match[1] ?? '';
    const from = match.index + match[0].length;
    const local = { name, from, to: endOfEnclosing(code, from) };

    startsBuilder.lastIndex = from;

    const isGiven = given.some(({ 1: other, index }) => other === name && from <= index && index <= local.to);

    if (isGiven || startsBuilder.test(code) || startsFromLocal(code, from, locals)) {
      locals.push(local);
    }
  }

  return locals;
}

function startsFromLocal(code: string, value: number, locals: readonly BuilderLocal[]): boolean {
  const first = new RegExp(NAME, 'y');

  first.lastIndex = value;

  const name = first.exec(code)?.[0];

  return locals.some((local) => local.name === name && local.from <= value && value <= local.to);
}

/** The chain after each use of a local, in the callbacks that name a parameter alike left out. */
function uses(code: string, local: BuilderLocal): readonly (readonly ChainLink[])[] {
  const { name, from, to } = local;
  const hidden = hiddenRanges(code, local);
  const use = new RegExp(`(?<![\\w$.])${escaped(name)}(?=\\s*\\??\\.)`, 'g');

  return [...code.slice(from, to).matchAll(use)]
    .map((match) => from + match.index)
    .filter((at) => !hidden.some(([start, end]) => start <= at && at <= end))
    .map((at) => chainLinks(code, at + name.length));
}

/** The callbacks in the life of a local with a parameter named as it: what they hold is the parameter. */
function hiddenRanges(code: string, { name, from, to }: BuilderLocal): readonly (readonly [number, number])[] {
  const parameter = new RegExp(
    `(?:\\(\\s*${escaped(name)}\\s*(?::[^()]*)?\\)|(?<![\\w$.])${escaped(name)})\\s*=>`,
    'g',
  );

  return [...code.slice(from, to).matchAll(parameter)].map((match) => {
    const start = from + match.index + match[0].length;

    return [start, endOfEnclosing(code, start, ',;')] as const;
  });
}

/** The links of a chain that leave the condition, and the ones a `modify` adds on the same builder through its callback. */
function linksOutside(file: SourceFile, links: readonly ChainLink[]): readonly ChainLink[] {
  return links.flatMap((link) => {
    if (isOrLink(link) || clearsConditions(file, link)) {
      return [link];
    }

    return link.method === 'modify' ? linksOfModify(file, link) : [];
  });
}

function clearsConditions(file: SourceFile, { method, argumentsAt }: ChainLink): boolean {
  return method === 'clearWhere' || (method === 'clear' && rawSqlText(file, argumentsAt) === 'where');
}

function linksOfModify(file: SourceFile, { argumentsAt, argumentsText }: ChainLink): readonly ChainLink[] {
  const callback = CALLBACK.exec(argumentsText);

  if (callback === null) {
    return [];
  }

  const local = {
    name: callback[1] ?? '',
    from: argumentsAt + callback[0].length,
    to: argumentsAt + argumentsText.length,
  };

  return uses(file.scan.code, local).flatMap((chain) => linksOutside(file, chain));
}

function escaped(name: string): string {
  return name.replaceAll('$', '\\$');
}
