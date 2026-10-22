import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { ClassNode } from '../classes/class-name';

/** A class that extends `DomainRefusal` of the kernel: one refusal, named after what is refused. */
export function isRefusalClass(node: ClassNode): boolean {
  return node.superClass?.type === AST_NODE_TYPES.Identifier && node.superClass.name === 'DomainRefusal';
}
