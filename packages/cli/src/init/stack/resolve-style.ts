import { ASSEMBLIES, STYLES } from '../../config/index.js';
import { CliError } from '../../cli-error.js';
import { choose } from './choose.js';
import type { StackOptions } from './stack-options.js';

/**
 * A class declares what it is wherever something reads the declarations: `@ddd-ts-kit/di`, on
 * tsyringe. Hand wiring and a NestJS container read none of them, so their contexts keep a
 * module file. A declared context is assembled from its barrel or by discovery, with or
 * without a broker: its subscriber is the one of its name either way.
 */
export function resolveStyle(options: StackOptions, di: string): { style: string; assembly: string } {
  const style = choose(STYLES, options.style, 'style') ?? (di === 'tsyringe' ? 'declared' : 'explicit');

  if (style === 'declared' && di !== 'tsyringe') {
    throw new CliError(
      `--style declared cannot be combined with --di ${di}.`,
      'The declarations of @ddd-ts-kit/kernel/declarations are turned into bindings by @ddd-ts-kit/di (contextModule, discoverContext), which runs on tsyringe: use --di tsyringe, or keep --style explicit, where every binding is written in <context>.module.ts.',
    );
  }

  const assembly = choose(ASSEMBLIES, options.assembly, 'assembly');

  if (assembly !== undefined && style !== 'declared') {
    throw new CliError(`--assembly ${assembly} cannot be combined with --style explicit.`, 'An explicit context is assembled by its module file: drop --assembly, or use --style declared.');
  }

  return { style, assembly: assembly ?? 'barrel' };
}
