import type { TSESLint } from '@typescript-eslint/utils';
import { plugin } from './plugin';
import { createDddTsKit, type DddTsKitOptions } from './presets/create-ddd-ts-kit';

/** The complete flat config of a ddd-ts-kit project. */
export function dddTsKit(options: DddTsKitOptions = {}): TSESLint.FlatConfig.ConfigArray {
  return createDddTsKit(plugin, options);
}
