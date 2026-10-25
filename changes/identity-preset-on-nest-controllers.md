**The identity preset is written for Nest controllers too: `init --preset identity --http nest --routes nest`.**
Under `"stack.routes": "nest"`, its twelve routes are Nest controllers built by Nest with the buses it
injects: their parts and their answers read from their signatures into the generated
`identity.controllers.ts`, their summaries, descriptions and refusal codes in `@KitRoute`, the shared
invitation token documented once as before. The module of the context lists those controllers, and
its spec mounts them through the pipeline of the kit, as the spec of each controller does. A
project on `--routes controllers` gets the controllers of the kit as before.
