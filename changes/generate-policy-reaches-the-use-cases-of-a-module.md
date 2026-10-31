**`generate policy` and `generate command|query` ask a policy in the use cases of a module of the model too.** A policy that refines the permission of `PayInvoice` made the handler ask it only when the use case sat outside a module; inside one, the handler never called `access.authorize` and `authz/policy-asked` reported it. Both orders now work, with or without `--module`.

To move: a handler generated inside a module before a policy existed gets its `access.authorize` call by hand.
