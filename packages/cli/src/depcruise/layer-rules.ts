import type { Config } from '../config';
import type { CruiseRule } from './cruise-rule';
import { escapePattern } from './escape-pattern';
import { packagePatterns } from './package-patterns';
import { testFiles } from './test-files';
import { payloadSchemaPackagesOf } from '../config/payload-schema-packages-of';

/** A background job of a context, `application/background/*.background-job.ts` and no deeper, past the layer. */
const BACKGROUND_JOB_FILE = '/background/[^/]+\\.background-job\\.ts$';

export function layerRules(config: Config): CruiseRule[] {
  return [
    domainPurity(config),
    applicationInward(config),
    backgroundJobInward(config),
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
      'domain/ imports only its own domain/, the code list of its context, the shared kernel and the allowed kernel packages. Invert the dependency: declare the need as a port, an abstract class in domain/repositories or application/ports.',
    from: { path: `${contextOf(config)}/${inAnyModule('domain')}/`, pathNot: testFiles(config) },
    to: {
      pathNot: [
        own(config, 'domain'),
        ownRootFile(config, 'codes'),
        sharedKernel(config),
        internalsOfOthers(config),
        ...packagePatterns(config.domainAllowedPackages),
      ],
    },
  };
}

function applicationInward(config: Config): CruiseRule {
  return {
    name: 'layer-application-inward',
    severity: 'error',
    comment:
      'application/ imports domain/, application/, the code list and the permission set of its context, published languages and the allowed kernel packages. Depend on a port and let the composition root bind the adapter.',
    from: {
      path: `${contextOf(config)}/${inAnyModule('application')}/`,
      pathNot: [...testFiles(config), backgroundJobOf(config)],
    },
    to: { pathNot: [...inwardOf(config), ...packagePatterns(config.applicationAllowedPackages)] },
  };
}

/**
 * A background job, the same rule but for the validation library its payload schema is written
 * with: a stored payload outlives the deploy that enqueued it, like the payload of an integration event.
 */
function backgroundJobInward(config: Config): CruiseRule {
  const allowed = [...config.applicationAllowedPackages, ...payloadSchemaPackagesOf(config.stack.validation)];

  return {
    name: 'layer-application-inward',
    severity: 'error',
    comment:
      'A background job (application/background/*.background-job.ts) imports what application/ imports, @ddd-ts-kit/validation and the validation library of the stack, for the schema of its payload. Depend on a port and let the composition root bind the adapter.',
    from: {
      path: backgroundJobOf(config),
      pathNot: testFiles(config),
    },
    to: { pathNot: [...inwardOf(config), ...packagePatterns(allowed)] },
  };
}

/** Anchored at the layer: a `background/` folder deeper in it holds no background job. */
function backgroundJobOf(config: Config): string {
  return `${contextOf(config)}/${inAnyModule('application')}${BACKGROUND_JOB_FILE}`;
}

/** What every file of application/ may import inside the project. */
function inwardOf(config: Config): string[] {
  const otherContexts = `^${escapePattern(config.contextsDir)}/(?!$1/)[^/]+/`;

  return [
    own(config, 'domain'),
    own(config, 'application'),
    ownRootFile(config, 'codes'),
    ownRootFile(config, 'permissions'),
    own(config, 'published-language'),
    sharedKernel(config),
    otherContexts,
  ];
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
    from: { path: `${contexts}/([^/]+)/${inAnyModule(from)}/`, pathNot: testFiles(config) },
    to: { path: `${contexts}/$1/${inAnyModule(to)}(/|\\.ts$)` },
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
  return `^${escapePattern(config.contextsDir)}/$1/${inAnyModule(layer)}(/|\\.ts$)`;
}

/** A file of the context at its root, named after it: the code list is of its domain, the permission set of its application. */
function ownRootFile(config: Config, kind: 'codes' | 'permissions'): string {
  return `^${escapePattern(config.contextsDir)}/$1/$1\\.${kind}\\.ts$`;
}

function sharedKernel(config: Config): string {
  return `^${escapePattern(config.sharedKernelDir)}/`;
}

/**
 * A layer of a context, at its level or in a module of its model, one folder holding its layers:
 * `domain` or `<module>/domain`, written as an alternative, which dependency-cruiser takes as safe.
 */
function inAnyModule(layer: string): string {
  return `(?:${layer}|[^/]+/${layer})`;
}
