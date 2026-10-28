import { insertInRegion, parseWiring, replaceInRegion } from '../../markers';
import { toName, type Name } from '../../naming';
import type { RenderContext } from '../../templating';
import type { Output } from '../emit';
import { rendered } from '../rendered';
import type { Scope } from '../scope';
import { wirings } from '../wirings';
import { commandContext } from './command-context';
import { commandOutputs } from './command-outputs';
import { queryContext } from './query-context';
import { queryOutputs } from './query-outputs';

/** Both handlers of an aggregate import its repository; only the one that gives birth to it takes the generator of identifiers. */
const AGGREGATE_IMPORT = /\/domain\/repositories\/([a-z0-9-]+)\.repository/;
const BIRTH = /\bIdGenerator\b/;

/** A use case as the generator writes it: the context of its templates, with or without the policy, its files and its wiring. */
interface Generated {
  readonly folder: string;
  readonly kind: string;
  readonly contextOf: (asksPolicy: boolean) => RenderContext;
  readonly outputs: readonly Output[];
}

/** A file of the use case: what it holds as generated, and what it holds once it asks the policy. */
interface Rewrite {
  readonly file: string;
  readonly was: string;
  readonly becomes: string;
}

/**
 * Writes again, asking the policy of its permission, a command or a plain query whose files are
 * still as the generator wrote them (layout aside): its handler, its spec and its registration.
 * False when one of them was changed since, or for a search: the code is then the team's, and
 * only a marker is left.
 */
export function askPolicyInGeneratedUseCase(scope: Scope, useCase: string, kind: string): boolean {
  const generated = generatedUseCase(scope, toName(useCase), kind);

  if (generated === undefined) {
    return false;
  }

  const plain = generated.contextOf(false);
  const asking = generated.contextOf(true);

  const files: Rewrite[] = generated.outputs
    .filter(([, target]) => /\.handler(?:\.spec)?\.ts$/.test(target))
    .map(([template, target]) => ({
      file: `${scope.dir}/${target}`,
      was: scope.ws.spoken(rendered(scope, template, plain)),
      becomes: scope.ws.spoken(rendered(scope, template, asking)),
    }));

  const registrations = rewired(scope, generated.kind, { plain, asking });

  if (registrations === undefined || files.some(({ file, was }) => !sameCode(scope.ws.read(file) ?? '', was))) {
    return false;
  }

  for (const { file, becomes } of [...files, ...registrations]) {
    scope.ws.update(file, becomes);
  }

  scope.ws.step({
    file: `${scope.dir}/${generated.folder}/${useCase}.handler.ts`,
    anchor: 'TODO(domain): a policy refines',
    text: `ask the policy about the element the ${kind} acts on once it is loaded, in place of \`${kind}\`.`,
  });

  return true;
}

function generatedUseCase(scope: Scope, name: Name, kind: string): Generated | undefined {
  if (kind === 'command') {
    const folder = `application/commands/${name.kebab}`;
    const handler = scope.ws.read(`${scope.dir}/${folder}/${name.kebab}.handler.ts`) ?? '';
    const aggregate = AGGREGATE_IMPORT.exec(handler)?.[1];

    const of = {
      name,
      aggregate: aggregate === undefined ? undefined : toName(aggregate),
      creates: BIRTH.test(handler),
    };

    return {
      folder,
      kind: 'command',
      contextOf: (asksPolicy) => commandContext(scope, of, asksPolicy),
      outputs: commandOutputs(scope, name),
    };
  }

  const folder = `application/queries/${name.kebab}`;
  const handler = scope.ws.read(`${scope.dir}/${folder}/${name.kebab}.handler.ts`) ?? '';

  // A search asks the access scope of its actor: no element, no policy to ask.
  return handler.includes('access.scope(')
    ? undefined
    : {
        folder,
        kind: 'query',
        contextOf: (asksPolicy) => queryContext(scope, name, asksPolicy),
        outputs: queryOutputs(scope, name, ''),
      };
}

/** The files of the wiring with the registration of the use case changed, or undefined when one is not found as written. */
function rewired(
  scope: Scope,
  kind: string,
  { plain, asking }: { plain: RenderContext; asking: RenderContext },
): Rewrite[] | undefined {
  const after = wirings(scope, { kind }, asking);
  const rewrites: Rewrite[] = [];

  for (const [index, { file, wiring }] of wirings(scope, { kind }, plain).entries()) {
    const was = scope.ws.read(file) ?? '';
    const becomes = withBlocks(was, scope.ws.spoken(wiring), scope.ws.spoken(after[index]?.wiring ?? ''));

    if (becomes === undefined) {
      return undefined;
    }

    rewrites.push({ file, was, becomes });
  }

  return rewrites;
}

function withBlocks(content: string, plain: string, asking: string): string | undefined {
  const blocks = parseWiring(asking);
  let written: string | undefined = content;

  for (const [region, block] of parseWiring(plain)) {
    const next = blocks.get(region) ?? '';

    if (written === undefined || block === next) {
      continue;
    }

    written =
      region === 'imports'
        ? insertInRegion(written, region, next)
        : replaceInRegion(written, region, { replaced: block, by: next });
  }

  return written;
}

/** The same code, whatever the layout a formatter gave it. */
function sameCode(one: string, other: string): boolean {
  return one.replace(/\s+/g, '') === other.replace(/\s+/g, '');
}
