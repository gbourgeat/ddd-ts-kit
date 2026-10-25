**`@KitRoute` is optional: each method of a Nest controller the kit serves that carries a route decorator of Nest is a route, named after the method.**
`@Post`, `@Get` and the other route decorators of Nest are enough: the route is named by the
method (`issueInvoice`), summed up by its name as a sentence (`Issue invoice`), behind the guards
of `@KitRoutes` on the class. `@KitRoute` says only what Nest does not: another name, guards of its
own, the refusals it answers, the body it answers (a method that returns a value without it is
still refused, never answered empty). `generate route` under `"stack.routes": "nest"` no longer
writes the name and the summary, and `nest/no-parallel-pipeline` takes a file that imports
`KitRoutes` alone for a controller the kit serves. The docs say that a generated controller
injects the buses only, the providers the platform gives Nest.
