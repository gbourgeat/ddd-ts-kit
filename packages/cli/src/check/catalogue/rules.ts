import type { Rule } from '../model/rule';
import { configValid } from '../rules/config-valid';
import { ARCHITECTURE_RULES } from './architecture-rules';

export const RULES: readonly Rule[] = [...ARCHITECTURE_RULES, configValid];
