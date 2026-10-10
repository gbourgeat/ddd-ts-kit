import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { isConstructor } from '../classes/is-constructor.js';
import { isFunction } from '../classes/is-function.js';
import { visibilityOf } from '../classes/visibility-of.js';

type Callable =
  | TSESTree.FunctionDeclaration
  | TSESTree.TSDeclareFunction
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSEmptyBodyFunctionExpression;

/**
 * The syntax that states what a declaration offers to its callers: the parameters and the
 * return type of a function, the constructor, the public members and the heritage of a class,
 * the whole of an interface or of a type alias, the annotation of a constant.
 */
export function signatureOf(node: TSESTree.Node): TSESTree.Node[] {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration || node.type === AST_NODE_TYPES.TSDeclareFunction) {
    return callableSignature(node);
  }

  if (node.type === AST_NODE_TYPES.ClassDeclaration) {
    return classSignature(node);
  }

  if (node.type === AST_NODE_TYPES.VariableDeclarator) {
    return variableSignature(node);
  }

  return node.type === AST_NODE_TYPES.TSInterfaceDeclaration || node.type === AST_NODE_TYPES.TSTypeAliasDeclaration
    ? [node]
    : [];
}

function callableSignature(node: Callable): TSESTree.Node[] {
  return [...node.params, node.returnType, node.typeParameters].filter((part) => part !== undefined);
}

function classSignature(node: TSESTree.ClassDeclaration): TSESTree.Node[] {
  const heritage = [node.typeParameters, node.superTypeArguments, ...node.implements].filter(
    (part) => part !== undefined,
  );

  return [...heritage, ...node.body.body.flatMap(memberSignature)];
}

function memberSignature(member: TSESTree.ClassElement): TSESTree.Node[] {
  if (visibilityOf(member) !== 'public' && !isConstructor(member)) {
    return [];
  }

  if (member.type === AST_NODE_TYPES.MethodDefinition || member.type === AST_NODE_TYPES.TSAbstractMethodDefinition) {
    return callableSignature(member.value);
  }

  return 'typeAnnotation' in member && member.typeAnnotation !== undefined ? [member.typeAnnotation] : [];
}

function variableSignature(node: TSESTree.VariableDeclarator): TSESTree.Node[] {
  const annotation = node.id.typeAnnotation === undefined ? [] : [node.id.typeAnnotation];

  return node.init !== null && isFunction(node.init) ? [...annotation, ...callableSignature(node.init)] : annotation;
}
