**A fresh context verifies the behaviour of a story at its close.** A sixth agent,
`story-verifier`, read-only, is launched by the story skill at its close phase, after the
`architecture-reviewer`: it reads the design review and the report of the story, starts the
application the way the end-to-end tests do (the acceptance of the story, then the end-to-end
specs of the two nearest flows), calls the routes the specs leave unexercised when the project
starts without a service, and reports what it ran, what it saw, and every behaviour that does not
match the design or a `D<n>` decision. It fixes nothing: the session settles each mismatch before
the report. A host without the agents of the plugin skips it, and the report says so.
