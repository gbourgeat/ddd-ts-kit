# ddd-ts-kit/context-extractable

Architecture id: `context/extractable`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context, tests excluded; each check in the place named below.

## Why

A bounded context is a deployable unit in waiting. Moving one to its own service must change a composition root and adapters, never domain or application code. A join on another context's table, a variable shared through an import or a token borrowed from another module each turn that move into a rewrite.

## Reported

In `infrastructure/persistence/`:

- `contextSchema('<other>')` or `schemaNameOf('<other>')` with the name of another context of the config
- a string or template literal that reads as SQL and names `<other_schema>.` or `"<other_schema>".`, the schema of another context of the config

In any file of a context:

- `export let` and `export var`
- an exported `const` holding `new Map`, `new Set`, `new WeakMap`, `new WeakSet`, `new Array`, an array literal or an object literal, when the same file changes it (`push`, `set`, `add`, `delete`, an assignment to a member, `Object.assign`, ...)

In `<context>.module.ts`:

- a name imported from another context, outside its `published-language/`, given to `bind`, `rebind`, `resolve`, or to `handledBy` and `toClass` (directly or in the dependency list)

Incorrect:

```ts
// billing/infrastructure/persistence/drizzle-invoice.repository.ts
await sql`select i.id, p.label from billing.invoices i join catalog.products p on p.id = i.product_id`;

// billing/application/ports/rate-cache.ts
export const rates = new Map<string, number>();
export function remember(currency: string, rate: number): void {
  rates.set(currency, rate);
}

// billing/billing.module.ts
import { CATALOG_READER } from '../catalog/catalog.module.js';
builder.query(GetPrice).public().handledBy(GetPriceHandler, [CATALOG_READER]);
```

Correct:

```ts
// billing keeps its own projection, fed by catalog.product.listed
await sql`select i.id, p.label from billing.invoices i join billing.products p on p.id = i.product_id`;

// billing/billing.module.ts
builder.bind(PRICE_SOURCE).toClass(InProcessPriceSource, [QUERY_BUS]).as('gateway');
builder.query(GetPrice).public().handledBy(GetPriceHandler, [PRICE_SOURCE]);
```

## Details

The schema of a context is its name with dashes turned into underscores, as `schemaNameOf` computes it. A text reads as SQL when it holds one of `select`, `insert`, `update`, `delete`, `from`, `join`, `into`, `references`. The import of another context's internals is itself reported by `context/published-language-only`; this rule reports what is done with it.

## Options

None.

`rules."context/extractable"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line context/extractable -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Only contexts listed under `contexts` in `ddd-ts-kit.config.json` are known as "another context".
- A table reached through a query builder (`knex('catalog.products')`, `.withSchema('catalog')`, a Drizzle table object imported from the other context) is not read as SQL; the import of that table object is reported by `context/published-language-only`.
- A column or an alias that happens to be called like another context (`catalog.id` where `catalog` is an alias) is reported: rename the alias.
- SQL outside `infrastructure/persistence/` is not read.
- A shared transaction (two contexts writing in one unit of work) is not visible in one file.
- An exported container changed only by its importers is not seen; one never changed is taken for a constant. `Object.freeze` is not required.
- A foreign token that reaches the module through the platform or the shared kernel is not seen: `dependency-cruiser` and the generated test that boots each context alone close that gap.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and from the config. This rule is the authority for the code.
