import type { Config } from '../config';
import type { CruiseRule } from './cruise-rule';
import { escapePattern } from './escape-pattern';
import { packagePatterns } from './package-patterns';
import { testFiles } from './test-files';

export function layerRules(config: Config): CruiseRule[] {
  return [
    domainPurity(config),
    applicationInward(config),
    sideways(config, {
      from: 'presentation',
      to: 'infrastructure',
      instead: 'Go through the command or query bus; the adapter is bound in the module file.',
    }),
    sideways(config, {
      from: 'infrastructure',
      to: 'presentation',
      instead: 'Move the shared type to application/ and let both sides import it from there.',
    }),
  ];
}

function domainPurity(config: Config): CruiseRule {
  return {
    name: 'layer-domain-purity',
    severity: 'error',
    comment:
      'domain/ imports only its own domain/, the shared kernel and the allowed kernel packages. Invert the dependency: declare the need as a port, an abstract class in domain/repositories or application/ports.',
    from: { path: `${contextOf(config)}/domain/`, pathNot: testFiles(config) },
    to: {
      pathNot: [
        own(config, 'domain'),
        sharedKernel(config),
        internalsOfOthers(config),
        ...packagePatterns(config.domainAllowedPackages),
      ],
    },
  };
}

function applicationInward(config: Config): CruiseRule {
  const otherContexts = `^${escapePattern(config.contextsDir)}/(?!$1/)[^/]+/`;

  const allowed = [
    own(config, 'domain'),
    own(config, 'application'),
    own(config, 'published-language'),
    sharedKernel(config),
    otherContexts,
  ];

  return {
    name: 'layer-application-inward',
    severity: 'error',
    comment:
      'application/ imports domain/, application/, published languages and the allowed kernel packages. Depend on a port and let the composition root bind the adapter.',
    from: { path: `${contextOf(config)}/application/`, pathNot: testFiles(config) },
    to: { pathNot: [...allowed, ...packagePatterns(config.applicationAllowedPackages)] },
  };
}

interface Sideways {
  readonly from: string;
  readonly to: string;
  readonly instead: string;
}

function sideways(config: Config, { from, to, instead }: Sideways): CruiseRule {
  const contexts = `^${escapePattern(config.contextsDir)}`;

  return {
    name: `layer-${from}-no-${to}`,
    severity: 'error',
    comment: `${from}/ never imports ${to}/. ${instead}`,
    from: { path: `${contexts}/([^/]+)/${from}/`, pathNot: testFiles(config) },
    to: { path: `${contexts}/$1/${to}(/|\\.ts$)` },
  };
}

/** Another context reached outside its published language: context-published-language-only reports it, once. */
function internalsOfOthers(config: Config): string {
  return `^${escapePattern(config.contextsDir)}/(?!$1/)[^/]+/(?!published-language(/|\\.ts$))`;
}

function contextOf(config: Config): string {
  return `^${escapePattern(config.contextsDir)}/([^/]+)`;
}

function own(config: Config, layer: string): string {
  return `^${escapePattern(config.contextsDir)}/$1/${layer}(/|\\.ts$)`;
}

function sharedKernel(config: Config): string {
  return `^${escapePattern(config.sharedKernelDir)}/`;
}
