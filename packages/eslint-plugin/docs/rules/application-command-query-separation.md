# ddd-ts-kit/application-command-query-separation

Architecture id: `application/command-query-separation` (added by this plugin). Default severity: `warn` in `recommended`, `error` in `strict`.

Applies to: files under `application/queries/` of a context, tests excluded.

## Why

A query answers and never changes state: it can then be retried, cached and run on a replica. A query that saves is a command with a return value.

## Reported

- a call of `save`, `delete` or `publish` on something held by the handler (`this.invoices.save(...)`, `this.#bus.publish(...)`)

Incorrect:

```ts
export class SearchInvoicesHandler {
  async execute(query: SearchInvoicesQuery): Promise<SearchInvoicesResult> {
    await this.audit.save(query);
    return this.reader.read(query);
  }
}
```

Correct:

```ts
export class SearchInvoicesHandler {
  async execute(query: SearchInvoicesQuery): Promise<SearchInvoicesResult> {
    return this.reader.read(query);
  }
}
```

## Details

Pragmatic by design: the rule matches method names on dependencies reached through `this`. A local `Set` whose `delete` is called is not reported.

## Options

`[{ "mutators": ["save", "delete", "publish"] }]` replaces the list of method names.

`rules."application/command-query-separation"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line application/command-query-separation -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A mutation behind another name (`upsert`, `record`) needs the `mutators` option.
- A dependency passed as an argument instead of injected is not followed.
- The other half of the principle, a command returning more than an identifier, is left to review.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
