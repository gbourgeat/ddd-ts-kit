import { describe, expect, it } from 'vitest';
import { parameterLists } from '../src/check/business-names/parameter-lists';

/** Each parameter list found, as the code it covers: `(a: A)`, or the name of the one parameter of `a =>`. */
function listsIn(code: string): string[] {
  return parameterLists(code).map((list) =>
    'open' in list ? code.slice(list.open, list.close + 1) : (/^[\w$]+/.exec(code.slice(list.single))?.[0] ?? ''),
  );
}

describe('the parameter lists of a source', () => {
  it('finds the parameters of an arrow that declares its return type, generic or literal', () => {
    expect(listsIn('const total = async (lines: Line[]): Promise<Money> => sum(lines);')).toEqual(['(lines: Line[])']);
    expect(listsIn('const shape = (input: Input): { ok: boolean } => ({ ok: true });')).toEqual(['(input: Input)']);
  });

  it('reads past the arrow of a function type inside a return type', () => {
    expect(listsIn('const handlers = (): Map<string, () => void> => new Map();')).toEqual(['()', '()']);
  });

  it('finds the one parameter of an arrow, also after the colon of a conditional', () => {
    expect(listsIn('const ids = orders.map(order => order.id);')).toEqual(['order']);
    expect(listsIn('const pick = flag ? first : second => second;')).toEqual(['second']);
  });

  it('finds no list for a parenthesis that never opens', () => {
    expect(listsIn('broken) => value;')).toEqual([]);
  });

  it('tells a method from a control statement and from a call, and reads a generator function', () => {
    expect(listsIn('class A {\n  if (x) {\n  }\n  place(order: Order): void {\n  }\n  run(a)\n}')).toEqual([
      '(order: Order)',
    ]);

    expect(listsIn('function* walk<T>(tree: Tree<T>) {}')).toEqual(['(tree: Tree<T>)']);
  });
});
