# ddd-ts-kit/application-handler-shape

Architecture id: `application/handler-shape` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `*.handler.ts` under `application/` of a context.

## Why

A handler is one use case: one class, called by the bus through `execute`. A second public method is a second use case hiding in the first, or a business decision that belongs to the domain.

## Reported

- a handler file that exports no class
- a second exported class
- a handler class without a public `execute`
- any other public method or function property, static ones included

Incorrect:

```ts
export class IssueInvoiceHandler {
  async handle(command: IssueInvoiceCommand): Promise<string> {}
  computeTotal(): number {}
}
```

Correct:

```ts
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  async execute(command: IssueInvoiceCommand): Promise<string> {}
  private total(): number {}
}
```

## Details

Types, interfaces and constants exported next to the class are allowed. `*.event-handler.ts` files are not handlers of the bus and are not judged.

## Options

None.

`rules."application/handler-shape"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line application/handler-shape -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The signature of `execute` is not checked against the command or query type: the compiler does it through `CommandHandler<T>` and `QueryHandler<T>`.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
