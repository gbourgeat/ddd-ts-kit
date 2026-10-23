import { describe, expect, it } from 'vitest';
import { selectAffected } from '../src/affected/select-affected';
import { parseConfig, readConfig, type Config } from '../src/config';
import { exists, REPO_ROOT, walk } from './helpers';

const EXAMPLE = `${REPO_ROOT}/examples/scheduling`;
const example = readConfig(EXAMPLE).config;

/** Change sets as pull requests of the example made them: the files exist, and each names what must run at least. */
const KNOWN_CHANGE_SETS: readonly (readonly [string, readonly string[], readonly string[]])[] = [
  [
    'a rule of the booking aggregate',
    ['src/contexts/scheduling/calendars/domain/aggregates/appointment.aggregate.ts'],
    ['scheduling', 'notification', 'analytics'],
  ],
  [
    'an event the scheduling context publishes',
    ['src/contexts/scheduling/published-language/index.ts'],
    ['scheduling', 'notification', 'analytics'],
  ],
  [
    'the identity context, upstream of all the others',
    ['src/contexts/identity/published-language/index.ts'],
    ['identity', 'scheduling', 'notification', 'analytics'],
  ],
  ['a leaf context', ['src/contexts/analytics/CONTEXT.md'], ['analytics']],
  [
    'two leaves at once',
    ['src/contexts/analytics/CONTEXT.md', 'src/contexts/notification/CONTEXT.md'],
    ['notification', 'analytics'],
  ],
  [
    'the platform, which composes every context',
    ['src/platform/composition/compose-application.ts'],
    ['identity', 'scheduling', 'notification', 'analytics'],
  ],
  [
    'the context map itself',
    ['ddd-ts-kit.config.json', 'src/contexts/analytics/CONTEXT.md'],
    ['identity', 'scheduling', 'notification', 'analytics'],
  ],
  ['a dependency update', ['package.json'], ['identity', 'scheduling', 'notification', 'analytics']],
];

describe('the affected selection is never narrower than the declared dependencies', () => {
  it.each(KNOWN_CHANGE_SETS)('replays a known change set of the example: %s', (_name, changed, expected) => {
    for (const file of changed) {
      expect(exists(EXAMPLE, file), `${file} exists in the example`).toBe(true);
    }

    expect(selectAffected(example, changed).contexts).toEqual(expect.arrayContaining([...expected]));
  });

  it('for every file of the example: its context and every context that depends on it run, or everything does', () => {
    const narrower: string[] = [];

    for (const file of walk(EXAMPLE).filter((candidate) => !candidate.startsWith('coverage/'))) {
      const { scope, contexts } = selectAffected(example, [file]);
      const [, context = '', layer] = /^src\/contexts\/([^/]+)\/([^/]+)/.exec(file) ?? [];
      const needed = context === '' ? [] : layer === 'test' ? [context] : mustRun(example, context);

      const document =
        /^(docs|openapi|\.claude|\.github\/instructions|\.github\/copilot)\//.test(file) || /^[^/]+\.md$/.test(file);

      if (needed.some((name) => !contexts.includes(name)) || (context === '' && !document && scope !== 'all')) {
        narrower.push(file);
      }
    }

    expect(narrower).toEqual([]);
  });

  it('for every context map of four contexts without a cycle, whichever context changes', () => {
    const names = ['a', 'b', 'c', 'd'];

    const pairs = names.flatMap((upstream, index) =>
      names.slice(index + 1).map((downstream) => [upstream, downstream]),
    );

    let checked = 0;

    for (let mask = 0; mask < 2 ** pairs.length; mask += 1) {
      const edges = pairs.filter((_pair, index) => (mask & (1 << index)) !== 0);

      const config = parseConfig({
        contexts: Object.fromEntries(
          names.map((name) => [
            name,
            {
              classification: 'core',
              upstreams: edges.filter(([, downstream]) => downstream === name).map(([upstream]) => upstream),
            },
          ]),
        ),
      });

      for (const changed of names) {
        const selected = selectAffected(config, [`src/contexts/${changed}/domain/rule.ts`]).contexts;

        expect(selected, `${JSON.stringify(edges)}, ${changed} changed`).toEqual(
          expect.arrayContaining(mustRun(config, changed)),
        );

        checked += 1;
      }
    }

    expect(checked).toBe(256);
  });

  it('a context map with a cycle, which the checker refuses, still selects every context of the cycle', () => {
    const config = parseConfig({
      contexts: {
        a: { classification: 'core', upstreams: ['b'] },
        b: { classification: 'core', upstreams: ['a'] },
        c: { classification: 'core', upstreams: [] },
      },
    });

    expect(selectAffected(config, ['src/contexts/a/domain/rule.ts']).contexts).toEqual(['a', 'b']);
  });
});

function mustRun(config: Config, changed: string): string[] {
  return Object.keys(config.contexts).filter((context) => context === changed || dependsOn(config, context, changed));
}

/**
 * The oracle, written the other way round from the selection: a context depends on another when
 * walking up its declared upstreams reaches it. What must run for a changed context is that
 * context and every context that depends on it.
 */
function dependsOn(config: Config, context: string, target: string, seen: readonly string[] = []): boolean {
  const upstreams = (config.contexts[context]?.upstreams ?? []).map((upstream) => upstream.context);

  return upstreams.some(
    (upstream) =>
      upstream === target || (!seen.includes(upstream) && dependsOn(config, upstream, target, [...seen, context])),
  );
}
