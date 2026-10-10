import type { TSESLint } from '@typescript-eslint/utils';
import { plugin } from './plugin.js';
import { createDddTsKit, type DddTsKitOptions } from './presets/create-ddd-ts-kit.js';

/** The complete flat config of a ddd-ts-kit project. */
export function dddTsKit(options: DddTsKitOptions = {}): TSESLint.FlatConfig.ConfigArray {
  return createDddTsKit(plugin, options);
}
