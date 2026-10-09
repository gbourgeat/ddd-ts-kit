import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { ancestors } from './ancestors.js';

export type Visibility = 'public' | 'protected' | 'private';

export type ClassNode = TSESTree.ClassDeclaration | TSESTree.ClassExpression;

type Keyed = TSESTree.MethodDefinition | TSESTree.PropertyDefinition | TSESTree.AccessorProperty | TSESTree.TSAbstractMethodDefinition | TSESTree.TSAbstractPropertyDefinition | TSESTree.TSAbstractAccessorProperty;

/** `#secret` keeps its hash, so a private name never collides with a public one. */
export function memberName(member: TSESTree.ClassElement): string | undefined {
  return isKeyed(member) && !member.computed ? keyName(member.key) : undefined;
}

export function keyName(key: TSESTree.Node): string | undefined {
  if (key.type === AST_NODE_TYPES.PrivateIdentifier) return `#${key.name}`;
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  return key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string' ? key.value : undefined;
}

export function visibilityOf(member: TSESTree.ClassElement): Visibility {
  if (!isKeyed(member)) return 'public';
  if (member.key.type === AST_NODE_TYPES.PrivateIdentifier) return 'private';
  return member.accessibility ?? 'public';
}

export function isConstructor(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition {
  return member.type === AST_NODE_TYPES.MethodDefinition && member.kind === 'constructor';
}

export function constructorOf(body: TSESTree.ClassBody): TSESTree.MethodDefinition | undefined {
  return body.body.find(isConstructor);
}

/** A method with a body, or a property holding a function: what a reader calls a method. */
export function isCallable(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition | TSESTree.PropertyDefinition {
  if (member.type === AST_NODE_TYPES.MethodDefinition) return member.kind !== 'constructor' && member.value.type === AST_NODE_TYPES.FunctionExpression;
  return member.type === AST_NODE_TYPES.PropertyDefinition && member.value !== null && isFunction(member.value);
}

export function isFunction(node: TSESTree.Node): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return node.type === AST_NODE_TYPES.ArrowFunctionExpression || node.type === AST_NODE_TYPES.FunctionExpression;
}

export function className(node: ClassNode): string {
  return node.id?.name ?? 'the class';
}

export interface MemberSite {
  readonly member: TSESTree.ClassElement;
  readonly body: TSESTree.ClassBody;
}

/** The class member a node belongs to, for the innermost class around it. */
export function enclosingMember(node: TSESTree.Node): MemberSite | undefined {
  let child = node;
  for (const parent of ancestors(node)) {
    if (parent.type === AST_NODE_TYPES.ClassBody) {
      const member = parent.body.find((candidate) => candidate === child);
      return member === undefined ? undefined : { member, body: parent };
    }
    child = parent;
  }
  return undefined;
}

function isKeyed(member: TSESTree.ClassElement): member is Keyed {
  return member.type !== AST_NODE_TYPES.StaticBlock && member.type !== AST_NODE_TYPES.TSIndexSignature;
}
