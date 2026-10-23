import { CliError } from '../cli-error.js';
import type { Config } from '../config/index.js';
import { toName } from '../naming/index.js';
import { declaredModules } from './declared-modules.js';

/**
 * The module of the model a command was given, in kebab-case as the config names it; refused,
 * with the command that declares it, when the context does not declare it.
 */
export function declaredModule(config: Config, context: string, asked: string): string {
  const module = toName(asked).kebab;
  const declared = declaredModules(config, context);

  if (!declared.includes(module)) {
    throw new CliError(
      `The context "${context}" declares no module "${module}".`,
      `Declare it first with \`ddd-ts-kit generate module ${context} ${module} --purpose "<which concepts it holds>"\`${declared.length > 0 ? `, or use one of: ${declared.join(', ')}` : ''}.`,
    );
  }

  return module;
}
