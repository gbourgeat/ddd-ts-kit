import { specifierOf } from '../../../alias';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';
import { contextWorld, type ReadWorld } from './context-world';
import { WORLD_COMMENTS } from './world-comments';

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

  if (world.kind !== 'read') {
    return withoutWorld(scope, spec, world);
  }

  const lack = lackOf(world, needs);

  if (lack !== undefined) {
    return withoutWorld(scope, spec, lack);
  }

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

/** Why a spec arranges without the world: there is none, it could not be read, or it lacks what the spec needs. */
type WithoutWorld =
  | { readonly kind: 'absent' }
  | { readonly kind: 'unread'; readonly looksFor: string }
  | { readonly kind: 'lacking'; readonly missing: string };

/** The arrangement without the world, a comment and a hint saying why; `--force` only on a world the generator could read. */
function withoutWorld(scope: Scope, spec: RenderContext, why: WithoutWorld): RenderContext {
  const context = scope.context.kebab;
  const command = `npx ddd-ts-kit generate test-world ${context}`;
  const [comment, hint] = said(context, command, why);

  return {
    through: false,
    builder: '',
    import: '',
    options: '',
    async: spec['async'] ?? '',
    await: spec['await'] ?? '',
    comment: `// ${comment}`,
    hint,
  };
}

/** The comment of the spec and the note of the generator, for each reason. */
function said(context: string, command: string, why: WithoutWorld): readonly [comment: string, hint: string] {
  switch (why.kind) {
    case 'absent':
      return [
        WORLD_COMMENTS.absent(command),
        `\`${command}\` shortens the specs of ${context}: those generated after it arrange through it.`,
      ];
    case 'unread': {
      const unread = WORLD_COMMENTS.unread(context, why.looksFor);

      return [unread, unread];
    }
    case 'lacking':
      return [
        WORLD_COMMENTS.lacking(context, why.missing, command),
        `The world of ${context} ${why.missing}: the spec arranges without it. \`${command} --force\` writes it again, for the specs generated after.`,
      ];
  }
}

/**
 * What the spec needs that a world the generator read does not give or does not take: an option
 * missing from options that extend another type may be declared there, which the generator does
 * not follow, so the world is then not read rather than said to lack it.
 */
function lackOf(world: ReadWorld, needs: WorldNeeds): WithoutWorld | undefined {
  const fakes = (needs.fakes ?? []).filter((fake) => !world.fakes.has(fake));
  const options = (needs.options ?? []).map(([name]) => name).filter((name) => !world.options.has(name));
  const [hidden] = options;

  if (world.optionsType.extended && hidden !== undefined) {
    return { kind: 'unread', looksFor: `\`${hidden}\` in \`${world.optionsType.name}\`` };
  }

  const missing = [
    ...(fakes.length === 0 ? [] : [`gives no ${fakes.join(', ')}`]),
    ...(options.length === 0 ? [] : [`takes no ${options.join(', ')}`]),
  ].join(' and ');

  return missing === '' ? undefined : { kind: 'lacking', missing };
}

/** `{ modules: [holders], idPrefix: 'invoice' }`, or nothing when the spec hands the world nothing. */
function optionsOf(needs: WorldNeeds): string {
  const options = needs.options ?? [];

  return options.length === 0 ? '' : `{ ${options.map(([name, value]) => `${name}: ${value}`).join(', ')} }`;
}
