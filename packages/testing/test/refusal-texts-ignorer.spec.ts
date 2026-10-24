import { describe, expect, it } from 'vitest';
import {
  REFUSAL_TEXTS,
  refusalTextsIgnorer,
  type SyntaxNode,
  type SyntaxPath,
  type SyntaxScope,
  strykerPlugins,
} from '../src/mutation/refusal-texts-ignorer';

const TEXT: SyntaxNode = { type: 'StringLiteral', value: 'The slot is already held.' };
const TEMPLATE: SyntaxNode = { type: 'TemplateLiteral' };
const CODE: SyntaxNode = { type: 'StringLiteral', value: 'SLOT_TAKEN' };
const RULE: SyntaxNode = { type: 'StringLiteral', value: 'ends after it starts' };

/** What the file imports, by name: the module each name comes from. */
const IMPORTS: Readonly<Record<string, string>> = {
  InvalidSlot: '@/contexts/scheduling/calendars/domain/errors/invalid-slot.error',
  AppointmentError: '../errors/appointment.error',
  SlotTaken: './slot-taken.error.js',
  DomainError: '@ddd-ts-kit/kernel',
  InvariantViolation: '@ddd-ts-kit/kernel',
  AggregateRoot: '@ddd-ts-kit/kernel',
  Money: '@/contexts/billing/domain/value-objects/money.vo',
  Email: './email.vo',
};

/** The scope of the file: a name is bound to the import that brings it, or to nothing. */
const SCOPE: SyntaxScope = {
  getBinding(name) {
    const from = IMPORTS[name];

    if (from === undefined) {
      return undefined;
    }

    const declaration = pathOf({ type: 'ImportDeclaration', source: { value: from } }, null);

    return { path: pathOf({ type: 'ImportSpecifier' }, declaration) };
  },
};

/** A path as Babel hands it: the node, the list of its parent it sits in, its ancestors through `findParent`. */
function pathOf(node: SyntaxNode, parentPath: SyntaxPath | null, listKey?: string): SyntaxPath {
  return {
    node,
    parentPath,
    listKey,
    scope: SCOPE,
    findParent(test) {
      let current = parentPath;

      while (current !== null) {
        if (test(current)) {
          return current;
        }

        current = current.parentPath;
      }

      return null;
    },
  };
}

/** `<object>.<method>(..args)`, as a factory of an error is called. */
function staticCall(object: string, method: string, ...args: SyntaxNode[]): SyntaxNode {
  return {
    type: 'CallExpression',
    callee: {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: object },
      property: { type: 'Identifier', name: method },
    },
    arguments: args,
  };
}

function newCall(className: string, ...args: SyntaxNode[]): SyntaxNode {
  return { type: 'NewExpression', callee: { type: 'Identifier', name: className }, arguments: args };
}

function superCall(...args: SyntaxNode[]): SyntaxNode {
  return { type: 'CallExpression', callee: { type: 'Super' }, arguments: args };
}

function classExtending(superClass: string): SyntaxNode {
  return { type: 'ClassDeclaration', superClass: { type: 'Identifier', name: superClass } };
}

/** The path of one argument of a call, the call sitting in a class when one is given. */
function argumentOf(call: SyntaxNode, argument: SyntaxNode, within: SyntaxNode | null = null): SyntaxPath {
  const enclosing = within === null ? null : pathOf(within, null);

  return pathOf(argument, pathOf(call, enclosing), 'arguments');
}

describe('the refusal-texts ignorer, what a mutation run leaves out of the strings of the domain', () => {
  it('leaves the message of a refusal out, whether written as a string or as a template', () => {
    expect(refusalTextsIgnorer(argumentOf(staticCall('SlotTaken', 'refusal', TEXT), TEXT))).toMatch(
      /text of a refusal/,
    );

    expect(
      refusalTextsIgnorer(
        argumentOf(staticCall('SlotTaken', 'refusal', TEMPLATE, { type: 'ObjectExpression' }), TEMPLATE),
      ),
    ).toMatch(/refusal-by-code/);
  });

  it('keeps the code of a concept error measured, and leaves its message out', () => {
    const call = staticCall('AppointmentError', 'refusal', CODE, TEXT);

    expect(refusalTextsIgnorer(argumentOf(call, CODE))).toBeUndefined();
    expect(refusalTextsIgnorer(argumentOf(call, TEXT))).toMatch(/text of a refusal/);
  });

  it('leaves a text handed to a factory of a class imported from the errors of the context out, where the rule is checked', () => {
    expect(refusalTextsIgnorer(argumentOf(staticCall('InvalidSlot', 'forRule', RULE), RULE))).toMatch(
      /text of a refusal/,
    );

    expect(refusalTextsIgnorer(argumentOf(staticCall('InvalidSlot', 'forRule', TEMPLATE), TEMPLATE))).toMatch(
      /text of a refusal/,
    );

    expect(refusalTextsIgnorer(argumentOf(staticCall('AppointmentError', 'slotTaken', TEXT), TEXT))).toMatch(
      /text of a refusal/,
    );

    expect(refusalTextsIgnorer(argumentOf(staticCall('SlotTaken', 'forCalendar', TEXT), TEXT))).toMatch(
      /text of a refusal/,
    );
  });

  it('keeps a text handed to a factory of the model measured, whatever the factory is named', () => {
    expect(refusalTextsIgnorer(argumentOf(staticCall('Money', 'withCurrency', RULE), RULE))).toBeUndefined();
    expect(refusalTextsIgnorer(argumentOf(staticCall('Money', 'of', RULE), RULE))).toBeUndefined();
    expect(refusalTextsIgnorer(argumentOf(staticCall('Appointment', 'forPatient', RULE), RULE))).toBeUndefined();
  });

  it('leaves the message given to the parent of an error class out, and keeps what another class gives its parent', () => {
    expect(refusalTextsIgnorer(argumentOf(superCall(TEXT), TEXT, classExtending('DomainError')))).toMatch(
      /text of a refusal/,
    );

    expect(refusalTextsIgnorer(argumentOf(superCall(TEXT), TEXT, classExtending('AppointmentError')))).toMatch(
      /text of a refusal/,
    );

    expect(refusalTextsIgnorer(argumentOf(superCall(TEXT), TEXT, classExtending('AggregateRoot')))).toBeUndefined();
    expect(refusalTextsIgnorer(argumentOf(superCall(TEXT), TEXT))).toBeUndefined();
  });

  it('leaves the message of an error built with new out, and keeps the argument of any other new', () => {
    expect(refusalTextsIgnorer(argumentOf(newCall('InvariantViolation', TEXT), TEXT))).toMatch(/text of a refusal/);
    expect(refusalTextsIgnorer(argumentOf(newCall('SlotTaken', TEXT), TEXT))).toMatch(/text of a refusal/);
    expect(refusalTextsIgnorer(argumentOf(newCall('Email', TEXT), TEXT))).toBeUndefined();
    expect(refusalTextsIgnorer(argumentOf(newCall('Date', TEXT), TEXT))).toBeUndefined();
  });

  it('keeps every other string of the domain measured: the name of an event, a status, a key', () => {
    const name: SyntaxNode = { type: 'StringLiteral', value: 'scheduling.appointment.booked' };
    const property: SyntaxNode = { type: 'ObjectProperty' };

    expect(refusalTextsIgnorer(argumentOf(staticCall('this', 'record', name), name))).toBeUndefined();
    expect(refusalTextsIgnorer(argumentOf(staticCall('AppointmentStatus', 'of', name), name))).toBeUndefined();
    expect(refusalTextsIgnorer(pathOf(name, pathOf(property, null), 'value'))).toBeUndefined();
    expect(refusalTextsIgnorer(pathOf(staticCall('SlotTaken', 'refusal', TEXT), null))).toBeUndefined();
  });

  it('declares itself to Stryker as the ignorer named by the governed mutation', () => {
    expect(REFUSAL_TEXTS).toBe('refusal-texts');

    expect(strykerPlugins).toEqual([
      { kind: 'Ignore', name: 'refusal-texts', value: { shouldIgnore: refusalTextsIgnorer } },
    ]);
  });
});
