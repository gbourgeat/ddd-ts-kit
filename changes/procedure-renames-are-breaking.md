**A renamed `operationId` is a breaking change of the API when the routes are served as procedures, and the architecture reviewer says so.**
With `stack.rpc` set to `orpc` or `trpc`, a procedure is named by the `operationId` of its route
and called at that name: renaming it, giving a `GET` route another method (a tRPC query becomes a
mutation) or having a route receive a file breaks a front end already deployed, which answers
404 or calls it the wrong way. The table "Breaking or not" of the `document` skill lists these
three changes, the client SDK guide says it, and the `architecture-reviewer` agent reports them
from the diff of `openapi/`, blocking unless the change says its consumers move with it.
