import type { Config } from '../config/index.js';
import { CliError } from '../cli-error.js';
import { toName, type Name } from '../naming/index.js';
import type { KindRequest } from './kind.js';
import type { Scope } from './scope.js';

/** Opens the context named by the first positional argument of a request. */
export function openScope(request: KindRequest): Scope {
  const { ws, config, flags } = request;
  const context = toName(request.args[0] ?? '');

  if (config.contexts[context.kebab] === undefined) throw unknownContext(config, context);

  return { ws, config, context, dir: `${config.contextsDir}/${context.kebab}`, flags };
}

function unknownContext(config: Config, context: Name): CliError {
  const known = Object.keys(config.contexts);
  const create = `\`ddd-ts-kit generate context ${context.kebab} --classification <core|supporting|generic>\``;

  return new CliError(
    `Unknown context "${context.kebab}".`,
    known.length > 0 ? `Use one of: ${known.join(', ')}; or create it with ${create}.` : `Create it first with ${create}.`,
  );
}
