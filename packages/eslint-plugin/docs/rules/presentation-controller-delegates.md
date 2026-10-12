# ddd-ts-kit/presentation-controller-delegates

Architecture id: `presentation/controller-delegates` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `*.controller.ts` files of a context whose class carries `@Controller` of `@ddd-ts-kit/http`.

## Why

A controller holds no business logic, and the way to keep it so is to give it nothing to decide with. What it may be given is the bus of its method, a request mapper and a serializer. With a repository, a port or a domain service in its constructor, a rule would be written at the edge, where a job or an event handler calling the same use case does not pass.

## Reported

- a constructor parameter typed by anything else than `CommandBus`, `QueryBus`, a class named `*Mapper` or a class named `*Serializer`
- a `POST`, `PUT`, `PATCH` or `DELETE` controller given the `QueryBus`, and a `GET` or `HEAD` controller given the `CommandBus`
- a controller that is not given the bus of its method

Incorrect:

```ts
@Controller({ group: InvoicesRoutes, method: 'GET', path: '/:invoiceId', summary: 'Get invoice', response: { status: 200, body: answer } })
export class GetInvoiceController {
  constructor(
    private readonly commands: CommandBus,
    private readonly invoices: InvoiceRepository,
  ) {}
}
```

Correct:

```ts
@Controller({ group: InvoicesRoutes, method: 'GET', path: '/:invoiceId', summary: 'Get invoice', response: { status: 200, body: answer } })
export class GetInvoiceController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: GetInvoiceSerializer,
  ) {}
}
```

## Details

The method is read from the string literal of the declaration; a declaration built elsewhere is judged on its dependencies only. A controller without a constructor is reported for the missing bus.

## Options

None.

`rules."presentation/controller-delegates"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line presentation/controller-delegates -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The body of `handle` is not read: a controller that computes in `handle` what a use case should decide is not seen. The dependencies it would need for anything serious are.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the constructor of a class needs a syntax tree.
