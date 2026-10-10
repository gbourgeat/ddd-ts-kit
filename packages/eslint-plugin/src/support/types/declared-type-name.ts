import { ASTUtils, AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { accessedName } from '../calls/accessed-name.js';
import { constructorOf } from '../classes/constructor-of.js';
import { enclosingMember } from '../classes/enclosing-member.js';
import { memberName } from '../classes/member-name.js';
import { parameterName } from '../members/parameter-name.js';
import { parameterProperties } from '../members/parameter-properties.js';
import { startsAtThis } from '../members/starts-at-this.js';
import { typeReferenceName } from './type-reference-name.js';

type Source = Readonly<TSESLint.SourceCode>;

/** Read from the declaration, without type information: a parameter, a variable, a property or a parameter property. */
export function declaredTypeName(sourceCode: Source, node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return variableTypeName(sourceCode, node);

  const name = startsAtThis(node) ? accessedName(node) : undefined;
  const body = enclosingMember(node)?.body;

  return name === undefined || body === undefined ? undefined : propertyTypeName(body, name);
}

function variableTypeName(sourceCode: Source, node: TSESTree.Identifier): string | undefined {
  const declared = ASTUtils.findVariable(sourceCode.getScope(node), node.name)?.defs[0]?.name;

  return declared?.type === AST_NODE_TYPES.Identifier ? typeReferenceName(declared.typeAnnotation) : undefined;
}

function propertyTypeName(body: TSESTree.ClassBody, name: string): string | undefined {
  const property = body.body.find((member) => member.type === AST_NODE_TYPES.PropertyDefinition && memberName(member) === name);

  if (property?.type === AST_NODE_TYPES.PropertyDefinition) return typeReferenceName(property.typeAnnotation);

  const parameter = parameterProperties(constructorOf(body)).find((candidate) => parameterName(candidate) === name);

  return parameter?.parameter.type === AST_NODE_TYPES.Identifier ? typeReferenceName(parameter.parameter.typeAnnotation) : undefined;
}
