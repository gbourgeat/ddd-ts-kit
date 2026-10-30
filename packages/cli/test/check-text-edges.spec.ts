import { describe, expect, it } from 'vitest';
import { closingParenthesis } from '../src/check/business-names/closing-parenthesis';
import { declaredBindings } from '../src/check/business-names/declared-bindings';
import { propertyBindings } from '../src/check/business-names/property-bindings';
import { scan } from '../src/check/scan/scan';
import { classBodyBrace } from '../src/check/structure/class-body-brace';
import { inlineFunctions } from '../src/check/structure/inline-functions';
import { signatureAt } from '../src/check/structure/signature-at';
import { lineOfSequence } from '../src/check/support/line-of-sequence';
import { balancedArguments } from '../src/check/tenancy/balanced-arguments';
import { declaredInArguments } from '../src/check/tenancy/declared-in-arguments';
import { afterTypeParameters } from '../src/check/text/after-type-parameters';
import { annotationBefore } from '../src/check/text/annotation-before';
import { callEnd } from '../src/check/text/call-end';
import { typeAt } from '../src/check/text/type-at';
import { typeClosing } from '../src/check/text/type-closing';
import { expressionRole } from '../src/check/values/entry-role';
import { exportedFunctionBody } from '../src/check/values/exported-function-body';
import { initializerOf } from '../src/check/values/initializer-of';
import { localDeclaration } from '../src/check/values/local-declaration';

describe('the text readers of the checker, on a text that ends before what they look for', () => {
  it('closes a parenthesis, a call and a type at the end of the text when nothing closes them', () => {
    expect(closingParenthesis('(a', 1)).toBe(2);
    expect(callEnd('(a', 1)).toBe(2);
    expect(typeClosing('<T', 0)).toBe(-1);
    expect(afterTypeParameters('<T', 0)).toBe(0);
    expect(classBodyBrace('class Money extends ValueObject<{ readonly cents: number }>', 11)).toBe(58);
  });

  it('reads a type up to the end of the text, or up to the bracket closing around it', () => {
    expect(typeAt('Foo', 0)).toBe('Foo');
    expect(typeAt('Foo>', 0)).toBe('Foo');
  });

  it('finds no annotation when a statement ends before the assignment', () => {
    expect(annotationBefore('a; b = {', 7)).toBeUndefined();
  });

  it('finds no body for a signature the text ends on', () => {
    expect(signatureAt('function f()', 10)).toBeUndefined();
  });

  it('counts the lines of an arrow whose expression runs to the end of the text', () => {
    const [arrow] = inlineFunctions(scan('const total = () =>\n  a +\n  b'), 0);

    expect(arrow).toMatchObject({ label: 'total', line: 1, bodyLines: 2 });
  });

  it('answers line 1 when the first needle of a sequence is absent', () => {
    expect(lineOfSequence('a\nb', ['zzz'])).toBe(1);
  });

  it('reads the arguments to the end of the text when no parenthesis closes them', () => {
    expect(balancedArguments('(a, b', 0)).toBe('a, b');
  });

  it('sees no declared local in a statement that does not hold the call', () => {
    const call = { statement: 'x.findMany({ where })', call: /\.insert\(/, at: 0 };

    expect(declaredInArguments('const where = tenantWhere(x);', call, /tenantWhere/)).toBe(false);
  });
});

describe('the bindings of a source', () => {
  it('reads the variable of a counting loop with no collection', () => {
    expect(declaredBindings('for (const i = 0; i < n; i += 1) {}')).toEqual([
      { name: 'i', offset: 11, kind: 'loop variable', source: '' },
    ]);
  });

  it('reads no property from a line that no brace encloses', () => {
    expect(propertyBindings('name: string;\n')).toEqual([]);
  });
});

describe('the role of an entry of an object literal', () => {
  it('is behaviour for a name bound to a function declaration of the module', () => {
    expect(expressionRole('helper', 'function helper() {}')).toBe('behaviour');
  });

  it('has no body for a constant declared without a value, and no declaration for an unknown name', () => {
    const declared = {
      name: 'x',
      kind: 'const' as const,
      line: 1,
      text: 'export const x',
      signature: 'export const x',
    };

    expect(initializerOf('export const x')).toBeUndefined();
    expect(exportedFunctionBody(declared)).toBeUndefined();
    expect(localDeclaration('const other = 1;', 'nope')).toBeUndefined();
  });
});
