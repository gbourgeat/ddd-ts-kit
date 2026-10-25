**What a method of a Nest controller takes is its signature too: `@Body() body: IssueInvoiceBody` is read into the generated `<context>.controllers.ts`, and `@KitRoute` no longer gives `request`.**
`withAnswers` of `@ddd-ts-kit/http/nest` becomes `withSignatures(controller, { method: { params,
query, headers, body, answer } })`: the DTO class of each part of the request a parameter takes
whole, as `ddd-ts-kit` reads it from the source, and the answer. The bridge validates each part by
that class, so a route no longer depends on `emitDecoratorMetadata`, which tsx and esbuild do not
write: `npm run dev` serves the same validation as the build. A generated Nest controller no longer
builds `paramsSchema` nor `bodySchema`, and its `@KitRoute` holds the refusal codes alone.
`nest/controllers-current` also reports a part taken whole by a type the kit cannot read (an inline
type, an interface, a `Record`) that `request` of `@KitRoute` does not give.

To move: replace `withAnswers(Controller, { method: X })` by `withSignatures(Controller, { method:
{ answer: X } })` where it was written by hand; a project on `--routes nest` runs `npx ddd-ts-kit
docs`, then drops `request` and the schemas it built from its generated controllers.
