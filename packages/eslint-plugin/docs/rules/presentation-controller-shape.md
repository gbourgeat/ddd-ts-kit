**English** · [Français](presentation-controller-shape.fr.md)

# ddd-ts-kit/presentation-controller-shape

Architecture id: `presentation/controller-shape` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `*.controller.ts` files whose class carries `@Controller` of `@ddd-ts-kit/http`.

## Why

A controller is one route: one class, called by the pipeline through `handle`. The class is found by the name of its file, read in one sitting, and its declaration is the single statement of the route. A second public method is a second route hiding in the first, or a translation that belongs to a request mapper or a serializer.

## Reported

- a second exported class in the file of a controller
- a controller class without a public `handle`
- any other public method or function property, static ones included

Incorrect:

```ts
@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', summary: 'Issue invoice', response: { status: 201, body: accepted } })
export class IssueInvoiceController {
  async execute(request: HttpRequest): Promise<IssueInvoiceAccepted> {}
  totalOf(body: IssueInvoiceBody): number {}
}
```

Correct:

```ts
@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', summary: 'Issue invoice', body, response: { status: 201, body: accepted } })
export class IssueInvoiceController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ body: IssueInvoiceBody }>): Promise<IssueInvoiceAccepted> {}
}
```

## Details

A `*.controller.ts` file that declares no controller of the kit, such as a NestJS controller written by hand, is not judged. Types, interfaces, constants and functions that are not exported may stand next to the class. That `handle` receives what the declaration validates and returns what it declares is checked by the compiler, on the decorator.

## Options

None.

`rules."presentation/controller-shape"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line presentation/controller-shape -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because the shape of a class needs a syntax tree.
