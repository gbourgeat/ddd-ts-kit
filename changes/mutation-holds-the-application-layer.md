**The mutation score holds the application layer too, at a floor of its own.** `governedMutation()`
mutates the application layer of every context beside its domain, at its level and in the modules
of its model, and `ddd-ts-kit mutation` scores each layer of each context against its floor: the
`mutation` key of `ddd-ts-kit.config.json` takes `"application"` beside `"domain"`, 75 by the
reference, five below the domain as the coverage reference steps down from one layer to the next,
and lowering it is a recorded deviation (`"what": "mutation.application"`). The use cases hold
rules the domain does not: the permission a command requires, the idempotence of a handler, the
event it publishes, the refusal it relays; a survivor there is a rule no test states as much as in
an aggregate. On the example the application layer scores 95.7, its lowest context 93.5, and the
run grows by twenty seconds: the initial test run is what the night pays for, not the mutants.

To move: nothing, unless a context sits under 75 on its application layer: `npm run test:mutation`
names the survivors to read, a test to write for each rule, or a deviation to record.
