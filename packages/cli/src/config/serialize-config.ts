import type { Config, ContextConfig } from './config.js';
import { DEFAULT_COMMIT_LIMITS } from './default-commit-limits.js';
import { isReferenceCoverage } from './is-reference-coverage.js';
import { writtenStack } from './written-stack.js';
import { formatJson } from '../json/format-json.js';

/** The config as written to disk: defaults are spelled out so the file documents itself. */
export function serializeConfig(config: Config): string {
  const {
    initVersion,
    sourceRoot,
    contextsDir,
    sharedKernelDir,
    platformDir,
    importAlias,
    importExtension,
    rules,
    domainAllowedPackages,
    applicationAllowedPackages,
  } = config;

  const written = {
    ...(initVersion === undefined ? {} : { initVersion }),
    sourceRoot,
    contextsDir,
    sharedKernelDir,
    platformDir,
    importAlias,
    importExtension,
    stack: writtenStack(config.stack),
    contexts: writtenContexts(config),
    rules,
    domainAllowedPackages,
    applicationAllowedPackages,
  };

  return formatJson({ ...written, ...optionalKeys(config) });
}

function writtenContexts(config: Config): Record<string, unknown> {
  const contexts = Object.entries(config.contexts).map(([name, context]): [string, unknown] => [
    name,
    {
      classification: context.classification,
      upstreams: context.upstreams,
      ...(context.extraDirectories.length > 0 ? { extraDirectories: context.extraDirectories } : {}),
      ...(context.deployable ? { deployable: true } : {}),
      ...(context.modules.length > 0 ? { modules: writtenModules(context.modules) } : {}),
    },
  ]);

  return Object.fromEntries(contexts);
}

function writtenModules(modules: ContextConfig['modules']): Record<string, unknown> {
  return Object.fromEntries(
    modules.map(({ name, classification }) => [name, classification === undefined ? {} : { classification }]),
  );
}

function optionalKeys(config: Config): Record<string, unknown> {
  const { deviations, standardInterfaces, businessNames, onePerFile, worker, commit, coverage } = config;

  const sized =
    commit.maxFiles !== DEFAULT_COMMIT_LIMITS.maxFiles || commit.maxLines !== DEFAULT_COMMIT_LIMITS.maxLines;

  return {
    ...(isReferenceCoverage(coverage) ? {} : { coverage }),
    ...(deviations.length > 0 ? { deviations } : {}),
    ...(Object.keys(standardInterfaces).length > 0 ? { standardInterfaces } : {}),
    ...(onePerFile.allow.length > 0 ? { onePerFile } : {}),
    ...writtenBusinessNames(businessNames),
    ...(sized ? { commit } : {}),
    ...(worker ? { worker } : {}),
    ...(config.worktrees === 'advised' ? {} : { worktrees: config.worktrees }),
    ...pipelineKeys(config),
  };
}

/** Written once a project changes the list of `naming/business-name`. */
function writtenBusinessNames({ words, allow }: Config['businessNames']): Record<string, unknown> {
  if (words === undefined && allow.length === 0) {
    return {};
  }

  return { businessNames: { ...(words === undefined ? {} : { words }), ...(allow.length > 0 ? { allow } : {}) } };
}

/** The extra jobs of the pipeline, the form of the contracts when they are not the defaults, and their clients once asked for. */
function pipelineKeys({ ci, openapi, sdk }: Config): Record<string, unknown> {
  return {
    ...(ci.extras.length > 0 ? { ci } : {}),
    ...(openapi.format !== 'yaml' || openapi.documents.length > 0 ? { openapi } : {}),
    ...(sdk === undefined
      ? {}
      : { sdk: { name: sdk.name, ...(sdk.access === undefined ? {} : { access: sdk.access }) } }),
  };
}
