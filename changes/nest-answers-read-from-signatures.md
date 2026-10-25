**What a method of a Nest controller answers is its signature: the kit reads it into a generated `<context>.controllers.ts`, and `@KitRoute` no longer says it.**
Under `"stack.routes": "nest"`, `ddd-ts-kit generate`, `docs` and the `dev` script write
`<context>.controllers.ts` at the root of each context: its Nest controllers, each with what its
route methods answer as their signatures say it (`Promise<IssuedInvoice>` a DTO class,
`Promise<Accepted>` an identifier, `Promise<void>` nothing), through `withAnswers` of
`@ddd-ts-kit/http/nest`. The module of the context lists them from that file, so `generate route`
no longer touches it, and the generated controller declares in `@KitRoute` its validation and its
refusal codes only, its status through `@HttpCode` of Nest when Nest would answer another. The
check `nest/controllers-current` keeps the file current and reports a route method whose answer
the kit cannot read into a schema (an array, an inline type, an interface, no type) and whose
`@KitRoute` declares no `response`. A DTO without a decorated field accepts the empty object
alone, as `whitelist` and `forbidNonWhitelisted` refuse any field.

To move: a project on `--routes nest` runs `npx ddd-ts-kit docs` once, and its context modules
list `<context>Controllers` from the generated file in place of their `controllers` list.
