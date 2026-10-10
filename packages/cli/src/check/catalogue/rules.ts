import type { Rule } from '../model/rule.js';
import { configValid } from '../rules/config-valid.js';
import { ARCHITECTURE_RULES } from './architecture-rules.js';

export const RULES: readonly Rule[] = [...ARCHITECTURE_RULES, configValid];
