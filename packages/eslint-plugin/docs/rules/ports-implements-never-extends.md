**English** · [Français](ports-implements-never-extends.fr.md)

# ddd-ts-kit/ports-implements-never-extends

Architecture id: `ports/implements-never-extends`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

An adapter honours a contract; it does not inherit from it. `implements` lets the compiler check the adapter against the port and keeps the port free of behaviour, so that a fake, an in-memory class and a remote client are interchangeable. `extends` turns the port into a base class and ties every adapter to it.

## Reported

- a class carrying `@Repository(Port, ..)`, `@Gateway(Port, ..)` or `@Adapter(Port, ..)` that does not write `implements Port`, or that `extends Port`
- the class given to `bind(Port).toClass(Class, ..)` or `rebind(Port).toClass(Class, ..)` that does not implement `Port`, or that extends it
- under `infrastructure/` of a context: a class that `extends` a class imported from a port file

Incorrect:

```ts
@Repository(InvoiceRepository)
export class KnexInvoiceRepository extends InvoiceRepository {
  constructor(private readonly database: Database) {}
}

builder.bind(PaymentGateway).toClass(StripePaymentGateway, [PaymentSettings]);
// where: export class StripePaymentGateway {}
```

Correct:

```ts
@Repository(InvoiceRepository)
export class KnexInvoiceRepository implements InvoiceRepository {
  constructor(private readonly database: Database) {}
}

export class StripePaymentGateway implements PaymentGateway {}
```

## Details

The class given to `toClass` is looked up in the linted file, then in the file it is imported from by a relative path or the import alias: that file is read from disk and parsed without types. When it cannot be found (a class of a package, a barrel, a renaming export), nothing is reported. A class bound to itself (`bind(Registry).toClass(Registry)`) is no port and is not judged. Port files are `domain/repositories/*.repository.ts` and `application/ports/*.port.ts`.

## Options

None.

`rules."ports/implements-never-extends"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line ports/implements-never-extends -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- `implements` is compared by name: `implements kernel.Clock` for a port named `Clock` is not recognised; import the port by name.
- An adapter that extends its port through an intermediate class of another file is not seen: the decorators refuse it when the file loads.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files. This rule is the authority for the code.
