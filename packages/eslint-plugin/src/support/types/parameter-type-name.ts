import type { TSESTree } from '@typescript-eslint/utils';
import { typeReferenceName } from './type-reference-name.js';
import { parameterBinding } from './parameter-binding.js';

export function parameterTypeName(parameter: TSESTree.Parameter): string | undefined {
  return typeReferenceName(parameterBinding(parameter).typeAnnotation);
}
