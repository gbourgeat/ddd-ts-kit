import type { Page } from '../pagination/page.js';
import type { HydratedPage } from './hydrated-page.js';
import type { HydrationPolicy } from './hydration-policy.js';
import type { HydrationRun } from './hydration-run.js';
import { HydrationTimeoutError } from './hydration-timeout-error.js';
import { loadRelation } from './load-relation.js';
import { property } from './property.js';

type Completing<Row, Extra> = (rows: readonly Row[], run: HydrationRun) => Promise<readonly Extra[]>;

interface Parts<Row, Extra> {
  readonly page: Page<Row>;
  readonly complete: Completing<Row, Extra>;
  readonly policies: ReadonlyMap<string, HydrationPolicy>;
}

/**
 * Rows being completed with what other bounded contexts know, relation by relation. Awaiting
 * it runs the lookups, all at once, each called once for the page. Immutable: `with` and
 * `orElse` answer a new hydration.
 */
export class Hydration<Row extends object, Extra extends object = object> implements PromiseLike<HydratedPage<Row & Extra>> {
  static of<Row extends object>(page: Page<Row>): Hydration<Row> {
    return new Hydration<Row>({ page, complete: (rows) => Promise.resolve(rows.map(() => ({}))), policies: new Map() });
  }

  private constructor(private readonly parts: Parts<Row, Extra>) {}

  /**
   * Adds the property `name` to every row whose key is known on the other side. `lookup`
   * receives the keys of the page, each once: typically the `byIds` of a gateway port.
   */
  with<Name extends string, Related>(
    name: Name,
    keyOf: (row: Row) => string | null | undefined,
    lookup: (ids: readonly string[]) => Promise<ReadonlyMap<string, Related>>,
  ): Hydration<Row, Extra & { readonly [Key in Name]?: Related }> {
    const { page, complete, policies } = this.parts;

    return new Hydration({
      page,
      policies,
      complete: async (rows, run) => {
        const [known, related] = await Promise.all([complete(rows, run), loadRelation({ name, keyOf, lookup }, rows, run)]);

        return known.flatMap((extra, index) => {
          const more = related[index];

          return more === undefined ? [] : [{ ...extra, ...more }];
        });
      },
    });
  }

  /**
   * Gives a relation the value of the rows it found nothing for, so the property is always
   * there. With `onFailure: 'fallback'`, a lookup that rejects or times out answers the
   * fallback too, and the result says so in `warnings`.
   */
  orElse<Name extends keyof Extra & string>(
    name: Name,
    fallback: NonNullable<Extra[Name]>,
    policy: HydrationPolicy = {},
  ): Hydration<Row, Extra & { readonly [Key in Name]: NonNullable<Extra[Name]> }> {
    const { page, complete, policies } = this.parts;

    return new Hydration({
      page,
      policies: new Map([...policies, [name, policy]]),
      complete: async (rows, run) => {
        const known = await complete(rows, run);

        if (policy.onFailure === 'fallback') forgive(run, name);

        return known.map((extra) => ({ ...extra, ...property(name, extra[name] ?? fallback) }));
      },
    });
  }

  then<Fulfilled = HydratedPage<Row & Extra>, Rejected = never>(
    onFulfilled?: ((page: HydratedPage<Row & Extra>) => Fulfilled | PromiseLike<Fulfilled>) | null,
    onRejected?: ((reason: unknown) => Rejected | PromiseLike<Rejected>) | null,
  ): PromiseLike<Fulfilled | Rejected> {
    return this.load().then(onFulfilled, onRejected);
  }

  private async load(): Promise<HydratedPage<Row & Extra>> {
    const { items, ...paging } = this.parts.page;
    const run: HydrationRun = { policies: this.parts.policies, failures: new Map(), warnings: [] };
    const extras = await this.parts.complete(items, run);

    for (const failure of run.failures.values()) throw failure;

    const hydrated = extras.flatMap((extra, index) => {
      const row = items[index];

      return row === undefined ? [] : [{ ...row, ...extra }];
    });

    return { ...paging, items: hydrated, warnings: run.warnings };
  }
}

function forgive(run: HydrationRun, relation: string): void {
  if (!run.failures.has(relation)) return;

  const code = run.failures.get(relation) instanceof HydrationTimeoutError ? 'lookup_timed_out' : 'lookup_failed';

  run.failures.delete(relation);
  run.warnings.push({ relation, code });
}
