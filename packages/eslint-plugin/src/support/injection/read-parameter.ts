import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { LANGUAGE_TYPES } from './language-types.js';
import type { ParameterReading } from './parameter-reading.js';

const ALWAYS_GIVEN = 'the composition root gives every parameter a value, always';

/**
 * Reads one constructor parameter of a declared class. `notClasses` are the names the file
 * declares as an interface, a type alias or an enum: what another file declares is read by
 * `ddd-ts-kit check`, which sees the project.
 */
export function readParameter(node: TSESTree.Parameter, notClasses: ReadonlyMap<string, string>): ParameterReading {
  const parameter = node.type === AST_NODE_TYPES.TSParameterProperty ? node.parameter : node;

  if (parameter.type === AST_NODE_TYPES.RestElement) {
    return { flaw: `is a rest parameter: ${ALWAYS_GIVEN}` };
  }

  if (parameter.type === AST_NODE_TYPES.AssignmentPattern) {
    return { flaw: `has a default value: ${ALWAYS_GIVEN}` };
  }

  if (parameter.type !== AST_NODE_TYPES.Identifier) {
    return { flaw: `is destructured: ${ALWAYS_GIVEN}` };
  }

  if (parameter.optional) {
    return { flaw: `is optional: ${ALWAYS_GIVEN}` };
  }

  return typed(parameter.typeAnnotation?.typeAnnotation, notClasses);
}

function typed(type: TSESTree.TypeNode | undefined, notClasses: ReadonlyMap<string, string>): ParameterReading {
  if (type === undefined) {
    return { flaw: 'has no type' };
  }

  if (type.type !== AST_NODE_TYPES.TSTypeReference || type.typeName.type !== AST_NODE_TYPES.Identifier) {
    return { flaw: 'is typed by something that names no single class' };
  }

  const { name } = type.typeName;
  const what = notClasses.get(name);

  if (what !== undefined) {
    return { flaw: `is typed \`${name}\`, ${what}: only a class exists at run time and can be an injection token` };
  }

  return LANGUAGE_TYPES.has(name)
    ? { flaw: `is typed \`${name}\`, a type of the language: it names nothing the composition root binds` }
    : { token: name };
}
