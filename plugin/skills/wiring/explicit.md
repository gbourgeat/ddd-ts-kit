# Explicit style: the module file

Read under `stack.style: explicit` (NestJS, manual wiring, or by choice), before writing a
binding. Why and how the two styles differ: `docs/concepts/ports-and-composition.md` of the kit,
"Two ways to tell the root what exists", and the three composition roots of
`docs/tools/dependency-injection.md`. What follows is what a session writes.

Every binding is written in `<context>.module.ts`, or in the module file of a module of the
model it composes (below): the only files of a context allowed to know every layer
(`composition/only-in-module`):

- `builder.bind(Port).toClass(Adapter, [Ports]).as('<kind>')`
- `builder.command(Message).requires(permission).handledBy(Handler, [Ports])` (or `.public()`)
- `builder.on(definition, { consumer }).handledBy(Handler, [Ports])`

Explicit stays explicit: the list of each statement names the ports of the constructor, in
order, and the compiler checks it; nothing is read from signatures here. Each port of a list is
imported as a value (`ports/value-import`). Generators add the lines between the markers. With
NestJS or manual wiring the rule is the same in another syntax; keep `@Injectable()` out of
`domain/` and `application/`.

The list of routes builds each controller by hand:
`...controllerRoutes([new IssueInvoiceController(commands)])`.

## A context divided into modules of the model

The module file splits the same way (`docs/concepts/modules.md` of the kit, "The tree"): each
module has `<module>/<module>.module.ts`, at the root of its folder, which registers what the
module holds (its handlers, consumers, reactions, jobs, permissions and routes), and
`<context>.module.ts` composes them and keeps what the context holds at its own level.

- `npx ddd-ts-kit generate module <context> <module>` writes the file and its composition (re-run
  it for a module declared before); `generate <kind> ... --module <module>` then writes the
  registration there.
- On a container of the kit the file exports `{ register(builder), onStart({ resolve }) }`, called from
  `register` and `onStart` of the context. Wired by hand it exports `registerHandlers`,
  `registerReactions`, `registerJobs`, `useCases()` and `routes(platform)`, called from the
  functions of the same names.
- Wired by hand, a repository is created once per context: a use case of another module that
  needs it is registered in the file that creates it.
- Registrations written before the split stay in `<context>.module.ts` until you move them by
  hand, with their imports.
- The `requires(...)` or `public...` declaration of each use case follows its registration: it
  is written in the module file of the module (`useCases()` when wired by hand), never in a file
  of `application/authorization/` (that folder holds the policies on one element, `*.policy.ts`,
  and a policy file that returns declarations is not one).
- A context whose module file nears the size limit takes its next use case with
  `--module <module>`; a context not divided yet is divided by its conductor with
  `generate module`.
- Never a `composition/` folder in `extraDirectories` for this: `tree/closed` accepts the module
  file of a declared module, and nothing else at the root of a module.
