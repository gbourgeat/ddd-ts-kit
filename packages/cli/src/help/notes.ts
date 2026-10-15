/** What a line of the usage cannot say about a command or a flag. */
export const NOTES = `  affected         what a pull request has to run: the contexts a change set reaches through the context
                   map (a changed context and the contexts downstream of it), as filters for the test
                   runner and the linter; everything when a shared path changed or without --base
  build-aliases    after the compiler: rewrites the import aliases left in the emitted .js and .d.ts files
                   into relative paths, so that plain node runs the output (tsconfig.build.json by default)
  error-factories  moves a project from one class per error to static factories on one error class per
                   concept: --plan writes error-factories.plan.json, where each class is given its concept;
                   --apply follows it (classes, specs, every usage, "stack.refusals" in the config)
  value-objects    moves the value objects of a project from a Result to factories that return the value or
                   throw: every create returning Result<T, E> returns T, err(..) is thrown, unwrap(..) of
                   them goes, specs assert expectRefusal(() => ..), "stack.valueObjects" becomes throwing
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, and the TODO(domain), TODO(platform) and it.todo left in each context
  sdk              the typed client of each document of the contract, a workspace package under
                   clients/<document> without runtime dependency: typed errors keyed by the error codes,
                   credentials per security scheme; records "sdk" in the config the first time, wires the
                   scripts (docs:generate regenerates it, docs:check compares it, ci:build builds it);
                   --check writes nothing and exits 1 while a client differs from its contract
  todo             those markers as file:line, in the project or in one context
  worker-scope     a git worktree on the branch build/<context> (by default ../<project>-<context>), cut from
                   --base <ref> (by default the current branch, refused from a worker's worktree), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context; --rows <id,...>
                   briefs those rows of slices.md only, with their rules; an existing worktree or branch
                   that does not contain the base is refused
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --stored-events  docs records the shape of each version of the stored events in stored-events.lock.json,
                   never rewriting a recorded one: run it once the shape of a version is the one to store;
                   docs --check fails while a declared version is not recorded
  --sdk            init records "sdk" in the config and generates the clients with the project
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do`;
