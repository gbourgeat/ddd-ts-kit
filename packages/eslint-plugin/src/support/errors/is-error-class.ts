import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ClassNode } from '../classes/class-name.js';

/** A class of an error file that extends something: `ConceptError`, `DomainError`, or a base of the project. */
export function isErrorClass(node: ClassNode): boolean {
  return node.superClass?.type === AST_NODE_TYPES.Identifier;
}
