import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className } from '../support/classes/class-name.js';
import { memberName } from '../support/classes/member-name.js';
import { visibilityOf } from '../support/classes/visibility-of.js';
import { descendants } from '../support/descendants.js';
import { constantCase } from '../support/errors/constant-case.js';
import { isErrorClass } from '../support/errors/is-error-class.js';
import { isErrorFile } from '../support/errors/is-error-file.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';

type MessageId = 'vagueName' | 'codeNotLiteral' | 'codeFormat' | 'mismatch';

/** Names that say an error is being made, never which rule of the business refused. */
const VAGUE_NAMES = ['create', 'make', 'of', 'from', 'build', 'new', 'error', 'failure', 'fail', 'refusal', 'refuse'];
const ERROR_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

interface Factory {
  readonly name: string;
  readonly concept: string;
  readonly method: TSESTree.MethodDefinition;
}

export const errorsFactoryName = defineRule<MessageId>({
  id: 'errors/factory-name',
  type: 'problem',
  recommended: 'error',
  description:
    'Under "stack.refusals": "factories", a static factory of an error class is named after the refusal, in the words of the business, and its code is that name in constant case, alone or with the name of the concept.',
  messages: {
    vagueName:
      '`{{className}}.{{name}}` says that an error is built, not which rule refused. Name the factory after the refusal, as a domain expert would say it: `slotTaken`, `alreadyConfirmed`, `notFound`.',
    codeNotLiteral:
      'The code `{{className}}.{{name}}` gives to `refusal(...)` is not a string literal. Write it in place, in constant case: the code is the contract of the refusal, read by the HTTP mapping, the OpenAPI document, the audit trail and the tests.',
    codeFormat:
      'The code "{{code}}" of `{{className}}.{{name}}` is not in constant case. Write upper-case words separated by underscores, for example {{expected}}.',
    mismatch:
      'The factory `{{className}}.{{name}}` sets the code "{{code}}", which says something else. Write {{expected}}, or rename the factory after the code: a reader of the code that refuses and a reader of the contract must meet the same words.',
  },
  create({ file, report }) {
    if (!isErrorFile(file)) {
      return {};
    }

    return {
      ClassBody(body) {
        if (!isErrorClass(body.parent)) {
          return;
        }

        const owner = className(body.parent);

        for (const method of body.body.filter(isFactory)) {
          judge({ name: memberName(method) ?? '', concept: owner, method }, report);
        }
      },
    };
  },
});

function isFactory(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition {
  return (
    member.type === AST_NODE_TYPES.MethodDefinition &&
    member.static &&
    member.kind === 'method' &&
    visibilityOf(member) === 'public' &&
    refusalCallIn(member) !== undefined
  );
}

function refusalCallIn(method: TSESTree.MethodDefinition): TSESTree.CallExpression | undefined {
  return [...descendants(method.value)].find(isRefusalCall);
}

function isRefusalCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  return (
    node.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.MemberExpression &&
    node.callee.property.type === AST_NODE_TYPES.Identifier &&
    node.callee.property.name === 'refusal'
  );
}

function judge(factory: Factory, report: Report<MessageId>): void {
  const { name, concept, method } = factory;
  const data = { className: concept, name };

  if (VAGUE_NAMES.includes(name.toLowerCase()) || /\d/.test(name)) {
    report({ node: method.key, messageId: 'vagueName', data });

    return;
  }

  const [code] = refusalCallIn(method)?.arguments ?? [];

  if (code?.type !== AST_NODE_TYPES.Literal || typeof code.value !== 'string') {
    report({ node: code ?? method.key, messageId: 'codeNotLiteral', data });

    return;
  }

  judgeCode(factory, { node: code, value: code.value }, report);
}

interface Code {
  readonly node: TSESTree.Node;
  readonly value: string;
}

function judgeCode(factory: Factory, code: Code, report: Report<MessageId>): void {
  const expected = expectedCodes(factory);
  const data = { className: factory.concept, name: factory.name, code: code.value };

  if (!ERROR_CODE.test(code.value)) {
    report({ node: code.node, messageId: 'codeFormat', data: { ...data, expected: expected[0] ?? '' } });

    return;
  }

  if (!expected.includes(code.value)) {
    report({ node: code.node, messageId: 'mismatch', data: { ...data, expected: expected.join(' or ') } });
  }
}

/** `AppointmentError.notFound` may set `NOT_FOUND`, `APPOINTMENT_NOT_FOUND` or `NOT_FOUND_APPOINTMENT`. */
function expectedCodes({ name, concept }: Factory): string[] {
  const refusal = constantCase(name);
  const subject = constantCase(concept.replace(/Error$/, ''));

  return subject === '' ? [refusal] : [refusal, `${subject}_${refusal}`, `${refusal}_${subject}`];
}
