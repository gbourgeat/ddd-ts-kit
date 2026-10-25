**A Nest project validates with class-validator and writes its routes as Nest controllers, by default.**
`init --http nest` now records `"validation": "class-validator"`, as Nest validates, and
`"routes": "nest"`: `generate route`, `file-upload`, `form` and `representation` write Nest
controllers built by Nest and served by the kit, their parts and answers read from their
signatures. `--validation zod` (or another library) keeps the controllers of the kit, and
`--routes controllers` asks for them on class-validator too. `describe`, `generate e2e` and every
reading of the routes of a context now read the route methods of Nest controllers, and the
generated list of a context holds the Nest controllers of its modules, which it left out.

To move: nothing for a recorded project, which keeps the stack its config says, `init --force`
included. A new Nest project that wants the controllers of the kit passes `--routes controllers`.
