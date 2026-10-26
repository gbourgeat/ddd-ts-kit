**A strategy of Passport authenticates the calls of the kit: `passportPrincipal` of `@ddd-ts-kit/auth/passport`.**
`passportPrincipal(strategy, { actorOf })` runs a strategy of Passport on each request, as
`passport.authenticate` does, and answers the session `resolvePrincipal` hands the pipeline: the
guards of the routes and the permissions of the use cases decide as with any authenticator, on
every door. A strategy of `passport-jwt` or a class of `@nestjs/passport` (given lazily, once Nest
has built it) works as it is; `actorOf` reads the user its verify callback or its `validate`
answered. It fails closed: a credential the strategy fails is a 401, an error, a redirect (a
sign-in flow) or a strategy silent past `timeoutMs` refuses the request, and only a request
without credential, or one the strategy passes, goes on anonymous. The entry imports nothing of
Passport. `nest/no-parallel-pipeline` now points `@nestjs/passport` in a context at it.
