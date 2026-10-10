import type { TSESTree } from '@typescript-eslint/utils';
import { isConstructor } from './is-constructor.js';

export function constructorOf(body: TSESTree.ClassBody): TSESTree.MethodDefinition | undefined {
  return body.body.find(isConstructor);
}
