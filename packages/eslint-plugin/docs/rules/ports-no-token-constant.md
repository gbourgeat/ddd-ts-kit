**English** · [Français](ports-no-token-constant.fr.md)

# ddd-ts-kit/ports-no-token-constant

Architecture id: `ports/no-token-constant`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

A port class is its own injection token. A constant next to it, a `token(..)` helper, a symbol or a string is a second name for the same thing: it has to be kept in step by hand, it loses the type, and it hides the dependency list from the compiler.

## Reported

- a call of `token`, imported from a package of the kit (`@ddd-ts-kit/*`), by name, by alias or through a namespace
- `Symbol(..)`, `Symbol.for(..)` or a string literal given as first argument of a binding call, and a variable declared as such a symbol given to one
- an identifier in upper snake case (two characters at least) in a dependency list
- a file named `*.ports.ts` or `tokens.ts` under the source root, reported on its first line

Incorrect:

```ts
// a constant that stands for the port, in a file that collects them
export const invoiceRepositoryToken = Symbol('billing.InvoiceRepository');

builder.bind(invoiceRepositoryToken).toClass(KnexInvoiceRepository, [Database]);
builder.bind('clock').toValue(clock);
```

Correct:

```ts
// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository extends Repository<Invoice> {}

builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database]);
builder.bind(Clock).toValue(clock);
```

## Details

A dependency list is the array that names what a constructor receives: the last argument of a declaration decorator of `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`, `@Repository`, `@Gateway`, `@Adapter`, `@Policy`) and the second argument of `.toClass(C, [..])` and `.handledBy(H, [..])` of `@ddd-ts-kit/di`.

A binding call is `bind`, `rebind`, `resolve`, `fake` or `override`, plain or as a member (`builder.bind(X)`, `app.resolve(X)`), and is read only in a file that imports something from `@ddd-ts-kit/di`; `Promise.resolve`, `path.resolve`, `require.resolve` and `import.meta.resolve` are never binding calls.

## Options

None.

`rules."ports/no-token-constant"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line ports/no-token-constant -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A token made by a home-made helper, or a symbol declared in another file, is not followed.
- An upper snake case name is reported in a dependency list only: a constant of the domain anywhere else is not a token.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files. This rule is the authority for the code.
