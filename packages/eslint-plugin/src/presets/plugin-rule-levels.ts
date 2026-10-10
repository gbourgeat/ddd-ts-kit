import { rules as pluginRules } from '../rules/rules.js';
import { docsOf } from '../support/rule/docs-of.js';
import { layoutRules } from './layout-rules.js';
import type { Rules } from './flat-rules.js';

/** Severity of every rule of this plugin: the documented default, or `error` everywhere. */
export function pluginRuleLevels(level: 'recommended' | 'error'): Rules {
  const own = Object.fromEntries(Object.entries(pluginRules).map(([name, rule]) => [`ddd-ts-kit/${name}`, level === 'error' ? 'error' : docsOf(rule).recommended]));

  return { ...own, ...layoutRules('error') };
}
