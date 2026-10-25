**A method of a Nest controller the kit serves that returns a value without `response.body` is refused, instead of answering an empty body.**
In Nest, what a method returns is the body of the answer; under `@KitRoute` the kit answers the
body its `response.body` declares, as the contract does, and dropped what an undeclared method
returned without a word. The routes are now refused when they are built if TypeScript recorded
that the method returns a value (`design:returntype`, under `emitDecoratorMetadata`), and an
`async` method, whose recorded type is only `Promise`, is refused at the call: a 500, the reason
told to `onError`.

To move: give `response: { body }` to each `@KitRoute` whose method returns what the caller reads,
or return nothing.
