import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { className } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { exportedClasses } from '../support/classes/exported-classes.js';
import { visibilityOf } from '../support/classes/visibility-of.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { answeredObjects } from '../support/values/answered-objects.js';
import { exportedBindings } from '../support/values/exported-bindings.js';
import { extendsValueObject } from '../support/values/extends-value-object.js';
import { holdsData } from '../support/values/holds-data.js';
import { isValueObjectPath } from '../support/values/is-value-object-path.js';

type MessageId =
  | 'noClass'
  | 'secondClass'
  | 'notValueObject'
  | 'publicConstructor'
  | 'noFactory'
  | 'exportedFunction'
  | 'exportedLiteral'
  | 'plainValue';

const GENERATE = '`npx ddd-ts-kit generate value-object <context> <Name>`';

export const domainValueObjectClass = defineRule<MessageId>({
  id: 'domain/value-object-class',
  type: 'problem',
  recommended: 'error',
  description:
    'A value object is a class: a file of domain/value-objects/ (or a *.vo.ts of the shared kernel) exports one class extending ValueObject, with a private or protected constructor and static factories, and no function or object literal; no exported function of domain/ answers a plain object holding data.',
  messages: {
    noClass: `The value object file exports no class. Write the value as a class, \`export class <Name> extends ValueObject<<Name>Props>\`, with a private constructor and a static factory that checks its rules (${GENERATE} writes one): a function or an object literal gives no equality by value, no single place for the invariants and nothing \`instanceof\` can recognise.`,
    secondClass:
      'The value object file exports a second class, {{className}}. Move it to a *.vo.ts of its own: one value object per file, named after it.',
    notValueObject:
      '{{className}} does not extend ValueObject. Extend ValueObject of @ddd-ts-kit/kernel, or another value object of the project: it gives equality by value (`equals`), frozen props and `toJSON`.',
    publicConstructor:
      'The constructor of {{className}} is public. Make it private (protected on a base other value objects extend) and build the value through a static factory, `{{className}}.create(..)`, that checks its rules: a {{className}} that exists is a valid one.',
    noFactory:
      '{{className}} has no static factory. Add `static create(..): {{className}}`, which checks the rules and returns `new {{className}}(..)`; name the other ones after what they build (`{{className}}.closed()`, `{{className}}.between(..)`).',
    exportedFunction:
      'The value object file exports the function {{name}}. Make it a static factory or a method of the value object class: what builds or reads the value lives next to its data.',
    exportedLiteral:
      'The value object file exports the object literal {{name}}. Make it a static factory of the class, `static {{name}}()`, which builds a checked instance; a closed list of values is a vocabulary (domain/vocabularies/*.vocabulary.ts).',
    plainValue: `{{name}} builds a plain object: a value of the model written as a function. Write it as a value object class (${GENERATE}): its rules checked once in a static factory, \`equals\` to compare two of them, its operations as methods next to its data. A domain service, a state machine, a specification or a function that takes and returns value objects stays as it is.`,
  },
  create({ file, report }) {
    if (isValueObjectPath(file.path, file.location, file.config.sharedKernelDir)) {
      return { Program: (program) => judgeValueObjectFile(file, program, report) };
    }

    const { location } = file;

    if (location.area !== 'context' || location.layer !== 'domain' || file.isTest) {
      return {};
    }

    return { Program: (program) => judgeDomainFunctions(program, report) };
  },
});

function judgeValueObjectFile(file: LintedFile, program: TSESTree.Program, report: Report<MessageId>): void {
  const [main, ...others] = exportedClasses(program);

  if (main === undefined) {
    report({ loc: { line: 1, column: 0 }, messageId: 'noClass' });
  } else {
    judgeClass(main, extendsValueObject(file, program, main), report);
  }

  for (const other of others) {
    report({ node: other.id ?? other, messageId: 'secondClass', data: { className: className(other) } });
  }

  for (const binding of exportedBindings(program)) {
    const messageId = binding.kind === 'function' ? 'exportedFunction' : 'exportedLiteral';

    report({ node: binding.at, messageId, data: { name: binding.name } });
  }
}

function judgeClass(node: TSESTree.ClassDeclaration, isValueObject: boolean, report: Report<MessageId>): void {
  const data = { className: className(node) };
  const constructor = constructorOf(node.body);

  if (!isValueObject) {
    report({ node: node.id ?? node, messageId: 'notValueObject', data });
  }

  if (constructor !== undefined && visibilityOf(constructor) === 'public') {
    report({ node: constructor.key, messageId: 'publicConstructor', data });
  }

  if (!node.abstract && !node.body.body.some(isFactory)) {
    report({ node: node.id ?? node, messageId: 'noFactory', data });
  }
}

function isFactory(member: TSESTree.ClassElement): boolean {
  return member.type === AST_NODE_TYPES.MethodDefinition && member.static && visibilityOf(member) !== 'private';
}

function judgeDomainFunctions(program: TSESTree.Program, report: Report<MessageId>): void {
  for (const binding of exportedBindings(program)) {
    if (binding.kind === 'function' && answeredObjects(binding.node).some(holdsData)) {
      report({ node: binding.at, messageId: 'plainValue', data: { name: binding.name } });
    }
  }
}
