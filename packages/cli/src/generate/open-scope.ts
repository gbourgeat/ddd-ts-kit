import type { Config } from '../config';
import { CliError } from '../cli-error';
import type { Name } from '../naming';
import { contextArgument } from './context-argument';
import { MissingPrerequisite } from './missing-prerequisite';
import type { KindRequest } from './kind';
import type { Scope } from './scope';
import { SHARED_KERNEL, sharedKernelScope } from './shared-kernel-scope';
import { ownEntry } from '../config/values/own-entry';

/** What a kind accepts as its first argument besides a context. */
export interface ScopeOptions {
  /** True for the kinds of what the shared kernel holds: a value object, its refusal, a schema. */
  readonly sharedKernel?: boolean;
}

/** Opens the context named by the first positional argument of a request, or the shared kernel for the kinds that write there. */
export function openScope(request: KindRequest, options: ScopeOptions = {}): Scope {
  const { ws, config, flags } = request;

  if (request.args[0] === SHARED_KERNEL) {
    if (options.sharedKernel === true) {
      return sharedKernelScope(request);
    }

    throw notInSharedKernel(config);
  }

  const context = contextArgument(config, request.args[0] ?? '');

  if (ownEntry(config.contexts, context.kebab) === undefined) {
    throw unknownContext(config, context);
  }

  const dir = `${config.contextsDir}/${context.kebab}`;

  flags.builtOn?.(`${dir}/CONTEXT.md`);

  return { ws, config, context, dir, flags };
}

function unknownContext(config: Config, context: Name): MissingPrerequisite {
  const known = Object.keys(config.contexts);
  const create = `\`ddd-ts-kit generate context ${context.kebab} --classification <core|supporting|generic>\``;

  return new MissingPrerequisite(
    `Unknown context "${context.kebab}".`,
    known.length > 0
      ? `Use one of: ${known.join(', ')}; or create it with ${create}.`
      : `Create it first with ${create}.`,
  );
}

function notInSharedKernel(config: Config): CliError {
  const known = Object.keys(config.contexts);
  const contexts = known.length > 0 ? `: ${known.join(', ')}` : '';

  return new CliError(
    `"${SHARED_KERNEL}" names the shared kernel (${config.sharedKernelDir}), which holds no file of this kind.`,
    `The shared kernel holds what at least two contexts use: \`generate value-object|domain-error|error|schema ${SHARED_KERNEL} ...\`. Anything else belongs to the context that owns it${contexts}.`,
  );
}
