import { CONFIG_FILE, type Config } from '../config/index.js';
import type { CruiseRule } from './cruise-rule.js';
import { escapePattern } from './escape-pattern.js';
import { packagePatterns } from './package-patterns.js';
import { testFiles } from './test-files.js';

export function contextRules(config: Config): CruiseRule[] {
  const contexts = `^${escapePattern(config.contextsDir)}`;
  const publishedLanguage = `${contexts}/[^/]+/published-language(/|\\.ts$)`;
  const declared = Object.keys(config.contexts);

  return [
    {
      name: 'context-published-language-only',
      severity: 'error',
      comment:
        "A file imports from another context only through that context's published-language/. Publish the missing contract there or react to an integration event.",
      from: { path: `${contexts}/([^/]+)/` },
      to: { path: `${contexts}/[^/]+/`, pathNot: [`${contexts}/$1/`, publishedLanguage] },
    },
    ...declared.map((name) => declaredRelationship(config, name)),
    undeclaredContext(config, publishedLanguage),
    {
      name: 'context-published-language-is-a-contract',
      severity: 'error',
      comment:
        'published-language/ imports only its allowed packages and other published languages. Declare the contract with plain serializable types written in that folder.',
      from: { path: publishedLanguage, pathNot: testFiles(config) },
      to: { pathNot: [publishedLanguage, ...packagePatterns(config.publishedLanguageAllowedPackages)] },
    },
  ];
}

function undeclaredContext(config: Config, publishedLanguage: string): CruiseRule {
  const contexts = `^${escapePattern(config.contextsDir)}`;
  const declared = Object.keys(config.contexts);

  return {
    name: 'context-declared-relationship',
    severity: 'error',
    comment: `A context missing from ${CONFIG_FILE} declares no upstream. Add it to "contexts" with its upstreams.`,
    from: { path: `${contexts}/([^/]+)/`, pathNot: declared.map((name) => `${contexts}/${escapePattern(name)}/`) },
    to: { path: publishedLanguage, pathNot: `${contexts}/$1/` },
  };
}

function declaredRelationship(config: Config, name: string): CruiseRule {
  const contexts = `^${escapePattern(config.contextsDir)}`;
  const upstreams = config.contexts[name]?.upstreams.map((upstream) => upstream.context) ?? [];
  const allowed = [name, ...upstreams].map(escapePattern).join('|');

  return {
    name: 'context-declared-relationship',
    severity: 'error',
    comment: `"${name}" imports the published language of a context that is not one of its upstreams. Declare the relationship under contexts.${name}.upstreams in ${CONFIG_FILE}, after checking that the direction is intended.`,
    from: { path: `${contexts}/${escapePattern(name)}/` },
    to: { path: `${contexts}/[^/]+/published-language(/|\\.ts$)`, pathNot: `${contexts}/(${allowed})/` },
  };
}
