import { ASSEMBLIES, DEPENDENCY_STATEMENTS, STYLES } from '../../config';
import { CliError } from '../../cli-error';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

/**
 * A class declares what it is wherever something reads the declarations: `@ddd-ts-kit/di`, on
 * tsyringe. Hand wiring and a NestJS container read none of them, so their contexts keep a
 * module file. A declared context is assembled from its barrel or by discovery, with or
 * without a broker: its subscriber is the one of its name either way. A new declared project
 * states dependencies in constructor signatures; an explicit one lists them in its module file.
 */
export function resolveStyle(options: StackOptions, di: string): Record<'style' | 'assembly' | 'dependencies', string> {
  const style = choose(STYLES, options.style, 'style') ?? (di === 'tsyringe' ? 'declared' : 'explicit');

  if (style === 'declared' && di !== 'tsyringe') {
    throw new CliError(
      `--style declared cannot be combined with --di ${di}.`,
      'The declarations of @ddd-ts-kit/kernel/declarations are turned into bindings by @ddd-ts-kit/di (contextModule, discoverContext), which runs on tsyringe: use --di tsyringe, or keep --style explicit, where every binding is written in <context>.module.ts.',
    );
  }

  const assembly = choose(ASSEMBLIES, options.assembly, 'assembly');

  if (assembly !== undefined && style !== 'declared') {
    throw new CliError(
      `--assembly ${assembly} cannot be combined with --style explicit.`,
      'An explicit context is assembled by its module file: drop --assembly, or use --style declared.',
    );
  }

  return { style, assembly: assembly ?? 'barrel', dependencies: dependenciesOf(options, style) };
}

function dependenciesOf(options: StackOptions, style: string): string {
  const dependencies = choose(DEPENDENCY_STATEMENTS, options.dependencies, 'dependencies');

  if (dependencies !== undefined && style !== 'declared') {
    throw new CliError(
      `--dependencies ${dependencies} cannot be combined with --style explicit.`,
      'An explicit context lists what each class is given in its module file: drop --dependencies, or use --style declared.',
    );
  }

  return dependencies ?? (style === 'declared' ? 'signature' : 'listed');
}
