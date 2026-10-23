import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { unresolvedTypes } from '../support/event-sourcing/unresolved-types';
import { defineRule, type Report } from '../support/rule/define-rule';

type MessageId = 'unnamed' | 'undeclared' | 'unresolved' | 'missingUpcaster';

interface StoredEvent {
  readonly node: TSESTree.CallExpression;
  readonly eventClass: string;
  readonly spec: TSESTree.ObjectExpression;
}

export const eventSourcingUpcasterRequired = defineRule<MessageId>({
  id: 'event-sourcing/upcaster-required',
  type: 'problem',
  recommended: 'error',
  description:
    'A stored event names the type of its data in `encode` and declares it, with every named type it reaches, in its codec file, and a version above 1 has an upcaster from each version below. The lock of recorded shapes is read by `ddd-ts-kit check`.',
  messages: {
    unnamed:
      'The encode of {{eventClass}} does not name the type of the data it stores. Write the stored shape as a named type in this file and answer it: `encode: (event): InvoiceIssuedData => ({ ... })`.',
    undeclared:
      '{{type}}, the data of {{eventClass}}, is not declared in this file. Declare it next to the events it stores: it is the stored shape, kept even when the domain event changes.',
    unresolved:
      '{{name}}, reached by {{type}} of {{eventClass}}, is not declared in this file: a change of it would change the stored shape unseen. Declare its stored shape in the codec file too, mapped from the domain type in encode.',
    missingUpcaster:
      '{{eventClass}} is stored in version {{version}} and has no upcaster from version {{from}}. Add `upcasters: { {{from}}: (data) => ({ ...data }) }`: events stored in version {{from}} are read through it.',
  },
  create({ report }) {
    const declared = new Map<string, TSESTree.Node>();
    const stored: StoredEvent[] = [];

    return {
      TSInterfaceDeclaration: (node) => declared.set(node.id.name, node),
      TSTypeAliasDeclaration: (node) => declared.set(node.id.name, node),
      TSEnumDeclaration: (node) => declared.set(node.id.name, node),
      CallExpression(node) {
        const [type, spec] = node.arguments;

        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === 'defineStoredEvent' &&
          type?.type === AST_NODE_TYPES.Identifier &&
          spec?.type === AST_NODE_TYPES.ObjectExpression
        ) {
          stored.push({ node, eventClass: type.name, spec });
        }
      },
      'Program:exit'() {
        for (const event of stored) {
          judge(event, declared, report);
        }
      },
    };
  },
});

function judge(event: StoredEvent, declared: ReadonlyMap<string, TSESTree.Node>, report: Report<MessageId>): void {
  const { node, eventClass, spec } = event;

  judgeShape(event, declared, report);

  const version = numberOf(property(spec, 'version'));
  const upcasters = upcasterKeys(property(spec, 'upcasters'));

  for (let from = 1; from < (version ?? 1); from += 1) {
    if (!upcasters.includes(from)) {
      report({
        node,
        messageId: 'missingUpcaster',
        data: { eventClass, version: String(version), from: String(from) },
      });
    }
  }
}

/** The data type is named, declared in the file, and so is every named type it reaches. */
function judgeShape(
  { node, eventClass, spec }: StoredEvent,
  declared: ReadonlyMap<string, TSESTree.Node>,
  report: Report<MessageId>,
): void {
  const type = payloadType(property(spec, 'encode'));

  if (type === undefined) {
    report({ node, messageId: 'unnamed', data: { eventClass } });
  } else if (!declared.has(type)) {
    report({ node, messageId: 'undeclared', data: { eventClass, type } });
  } else {
    for (const name of unresolvedTypes(type, declared)) {
      report({ node, messageId: 'unresolved', data: { eventClass, type, name } });
    }
  }
}

function property(spec: TSESTree.ObjectExpression, name: string): TSESTree.Node | undefined {
  const found = spec.properties.find(
    (candidate): candidate is TSESTree.Property =>
      candidate.type === AST_NODE_TYPES.Property && keyOf(candidate.key) === name,
  );

  return found?.value;
}

function keyOf(key: TSESTree.Node): string | undefined {
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }

  return key.type === AST_NODE_TYPES.Literal ? String(key.value) : undefined;
}

/** The name of the type an `encode` arrow, function or method declares as its return type. */
function payloadType(encode: TSESTree.Node | undefined): string | undefined {
  const isFunction =
    encode?.type === AST_NODE_TYPES.ArrowFunctionExpression || encode?.type === AST_NODE_TYPES.FunctionExpression;

  const annotation = isFunction ? encode.returnType?.typeAnnotation : undefined;

  return annotation?.type === AST_NODE_TYPES.TSTypeReference && annotation.typeName.type === AST_NODE_TYPES.Identifier
    ? annotation.typeName.name
    : undefined;
}

function numberOf(value: TSESTree.Node | undefined): number | undefined {
  return value?.type === AST_NODE_TYPES.Literal && typeof value.value === 'number' ? value.value : undefined;
}

function upcasterKeys(value: TSESTree.Node | undefined): number[] {
  if (value?.type !== AST_NODE_TYPES.ObjectExpression) {
    return [];
  }

  return value.properties.flatMap((candidate) =>
    candidate.type === AST_NODE_TYPES.Property ? [Number(keyOf(candidate.key))] : [],
  );
}
