import { specifierOf } from '../../../alias';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { contextWorld, type ContextWorld } from './context-world';

/** What a generated spec asks of the world of its context. */
export interface WorldNeeds {
  /** The fakes it takes from the world, by the name the world returns them under. */
  readonly fakes?: readonly string[];
  /** What it hands the world, in the order it writes them: `['modules', '[holders]']`. */
  readonly options?: readonly (readonly [name: string, value: string])[];
}

/**
 * How a generated spec arranges: through the world of its context when `test/worlds/<context>.world.ts`
 * exists and gives what the spec needs, else with the test application or the buses as before,
 * a comment and a hint saying what the world would change (`noteWorldArrangement`). `spec` holds
 * `async` and `await` of the arrangement without a world.
 */
export function worldArrangement(scope: Scope, spec: RenderContext, needs: WorldNeeds = {}): RenderContext {
  const world = contextWorld(scope);
  const missing = world === undefined ? '' : missingFrom(world, needs);

  if (world !== undefined && missing === '') {
    return {
      through: true,
      builder: world.builder,
      import: `import { ${world.builder} } from '${specifierOf(scope.config, world.file)}';`,
      options: optionsOf(needs),
      async: 'async ',
      await: 'await ',
      comment: '',
      hint: '',
    };
  }

  return withoutWorld(scope, spec, world === undefined ? undefined : missing);
}

/** The arrangement without the world, and what the world would change: written when it does not exist, or given what it lacks (`missing`). */
function withoutWorld(scope: Scope, spec: RenderContext, missing: string | undefined): RenderContext {
  const command = `npx ddd-ts-kit generate test-world ${scope.context.kebab}`;

  return {
    through: false,
    builder: '',
    import: '',
    options: '',
    async: spec['async'] ?? '',
    await: spec['await'] ?? '',
    comment:
      missing === undefined
        ? `// \`${command}\` shortens this: the specs generated after it arrange through the world.`
        : `// The world of ${scope.context.kebab} ${missing}: \`${command} --force\` writes it again.`,
    hint:
      missing === undefined
        ? `\`${command}\` shortens the specs of ${scope.context.kebab}: those generated after it arrange through it.`
        : `The world of ${scope.context.kebab} ${missing}: the spec arranges without it. \`${command} --force\` writes it again, for the specs generated after.`,
  };
}

/** What the spec needs that the world does not give or does not take: `gives no invoiceRepository`, or nothing. */
function missingFrom(world: ContextWorld, needs: WorldNeeds): string {
  const fakes = (needs.fakes ?? []).filter((fake) => !world.fakes.has(fake));
  const options = (needs.options ?? []).map(([name]) => name).filter((name) => !world.options.has(name));

  return [
    ...(fakes.length === 0 ? [] : [`gives no ${fakes.join(', ')}`]),
    ...(options.length === 0 ? [] : [`takes no ${options.join(', ')}`]),
  ].join(' and ');
}

/** `{ modules: [holders], idPrefix: 'invoice' }`, or nothing when the spec hands the world nothing. */
function optionsOf(needs: WorldNeeds): string {
  const options = needs.options ?? [];

  return options.length === 0 ? '' : `{ ${options.map(([name, value]) => `${name}: ${value}`).join(', ')} }`;
}
