import { specifierOf } from '../../../alias';
import type { RenderContext } from '../../../templating';
import type { Name } from '../../../naming';
import type { Scope } from '../../scope';
import { contextWorld, type ReadWorld } from './context-world';
import { WORLD_COMMENTS } from './world-comments';

/**
 * What a generated spec asks of the world of its context, named once for every kind: the fake of
 * the repository of its aggregate; and what it hands the world: the prefix of the identifiers it
 * gives birth to and, under a container, the module of its permission, the fake of a port the
 * world cannot build, the tenants of a per-tenant job. The buses take only the first two: the
 * spec registers its handler and guards the bus itself.
 */
export interface SpecAsks {
  readonly repository?: Name | undefined;
  readonly idPrefix?: string | undefined;
  /** The module of the permission it hands a container: `holders`, `authorization`. */
  readonly permission?: string | undefined;
  /** The fake it hands a container: `fake(GetInvoiceReader, new FakeGetInvoiceReader(answer))`. */
  readonly fake?: string | undefined;
  readonly perTenant?: boolean | undefined;
}

/** The variables of the templates under `world`, and the note the generator prints, if any. */
export interface WorldArrangement {
  readonly vars: RenderContext;
  readonly hint: string | undefined;
}

/** What the world gives and takes for a spec, from what it asks. */
interface WorldNeeds {
  /** The fakes it takes from the world, by the name the world returns them under. */
  readonly fakes: readonly string[];
  /** What it hands the world, in the order it writes them: `['modules', '[holders]']`. */
  readonly options: readonly (readonly [name: string, value: string])[];
}

/**
 * How a generated spec arranges: through the world of its context when `test/worlds/<context>.world.ts`
 * exists and gives what the spec needs, else with the test application or the buses as before,
 * and a comment and a hint saying why. `spec` holds `async` and `await` of the arrangement
 * without a world.
 */
export function worldArrangement(scope: Scope, spec: RenderContext, asks: SpecAsks = {}): WorldArrangement {
  const needs = needsOf(scope, asks);
  const world = contextWorld(scope);

  if (world.kind !== 'read') {
    return withoutWorld(scope, spec, world);
  }

  const lack = lackOf(world, needs);

  if (lack !== undefined) {
    return withoutWorld(scope, spec, lack);
  }

  const vars = {
    through: true,
    builder: world.builder,
    import: `import { ${world.builder} } from '${specifierOf(scope.config, world.file)}';`,
    options: optionsOf(needs),
    async: 'async ',
    await: 'await ',
    comment: '',
  };

  return { vars, hint: undefined };
}

function needsOf(scope: Scope, { repository, idPrefix, permission, fake, perTenant }: SpecAsks): WorldNeeds {
  const container = isContainer(scope);
  const handed = (name: string, value: string | undefined) => (value === undefined ? [] : [[name, value] as const]);

  return {
    fakes: repository === undefined ? [] : [`${repository.camel}Repository`],
    options: [
      ...(container ? handed('modules', permission === undefined ? undefined : `[${permission}]`) : []),
      ...(container ? handed('fakes', fake === undefined ? undefined : `[${fake}]`) : []),
      ...(container && perTenant === true ? handed('tenants', "['tenant-a', 'tenant-b']") : []),
      ...handed('idPrefix', idPrefix === undefined ? undefined : `'${idPrefix}'`),
    ],
  };
}

/** Under a container the world replaces the whole arrangement; on the buses, one line of it. */
function isContainer(scope: Scope): boolean {
  return scope.config.stack.di === 'tsyringe';
}

/** Why a spec arranges without the world: there is none, it could not be read, or it lacks what the spec needs. */
type WithoutWorld =
  | { readonly kind: 'absent' }
  | { readonly kind: 'unread'; readonly looksFor: string }
  | { readonly kind: 'lacking'; readonly missing: string };

/**
 * The arrangement without the world, a comment and a hint saying why; `--force` only on a world
 * the generator could read; nothing about a world that does not exist on the buses, where it
 * would change one line.
 */
function withoutWorld(scope: Scope, spec: RenderContext, why: WithoutWorld): WorldArrangement {
  const context = scope.context.kebab;
  const command = `npx ddd-ts-kit generate test-world ${context}`;
  const [comment, hint] = why.kind === 'absent' && !isContainer(scope) ? ['', undefined] : said(context, command, why);

  const vars = {
    through: false,
    builder: '',
    import: '',
    options: '',
    async: spec['async'] ?? '',
    await: spec['await'] ?? '',
    comment: comment === '' ? '' : `// ${comment}`,
  };

  return { vars, hint };
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
  const fakes = needs.fakes.filter((fake) => !world.fakes.has(fake));
  const options = needs.options.map(([name]) => name).filter((name) => !world.options.has(name));
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
  const { options } = needs;

  return options.length === 0 ? '' : `{ ${options.map(([name, value]) => `${name}: ${value}`).join(', ')} }`;
}
