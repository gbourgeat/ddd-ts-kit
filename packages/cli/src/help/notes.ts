/** What a line of the usage cannot say about a command or a flag. */
export const NOTES = `  affected         what a pull request has to run: the contexts a change set reaches through the context
                   map (a changed context and the contexts downstream of it), as filters for the test
                   runner and the linter; everything when a shared path changed or without --base;
                   --run <script> runs that script of the project on them (DDD_TS_KIT_AFFECTED set,
                   --passWithNoTests on a partial run) and nothing when nothing that runs changed:
                   the pre-push hook tests the contexts its branch reaches
  build-aliases    after the compiler: rewrites the import aliases left in the emitted .js and .d.ts files
                   into relative paths, so that plain node runs the output (tsconfig.build.json by default)
  drizzle-generate the db:generate of a Drizzle project: drizzle-kit generate --name, which without a terminal
                   fails and names the fix when drizzle-kit would ask whether a column or table is renamed,
                   where drizzle-kit alone writes nothing and exits 0; then formats the snapshot and the
                   journal it wrote with the Biome or Prettier of the format script, and warns when the
                   SQL changes a primary key in an order that fails on PostgreSQL (exit code unchanged);
                   --replay, after merging the trunk into a branch when both added migrations: when the
                   history forks from --base <ref> (origin/main by default), deletes the migrations of the
                   branch the base does not have, with their snapshots and journal entries, then generates
                   each again on top, in order, under its name (working- dropped outside a worker's
                   worktree, a custom one keeping its SQL); when it does not fork, only renames them;
                   refused while the journal holds conflict markers, when two of them change the schema,
                   or when drizzle-kit now writes a generated one otherwise (edited by hand), the folder
                   then put back as it was
  error-factories  moves the refusals of a project to one class per refusal (--to named, the default), from
                   one class per error or from the factories of one error class per concept: --plan writes
                   error-factories.plan.json, where each refusal is given a class (the PascalCase of its
                   code, which it keeps) and a factory (for<Concept>), both editable; --apply follows it
                   (codes.ts per context, one class file per refusal, specs, every usage, the concept
                   classes left empty, "stack.refusals" in the config) and lists what it cannot rewrite
                   (a bare <Concept>Error.is(error), CodeOf<typeof <Concept>Error>); --to factories moves
                   one class per error to static factories on one error class per concept instead
  value-objects    moves the value objects of a project from a Result to factories that return the value or
                   throw: every create returning Result<T, E> returns T, err(..) is thrown, unwrap(..) of
                   them goes, specs assert expectRefusal(() => ..), "stack.valueObjects" becomes throwing
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  doctor           what an upgrade left to do: the scripts, the packages of the kit (at the ranges of this
                   version) and the agent permissions this version writes that the project lacks or writes
                   otherwise, and the git hooks (the lefthook: line of lefthook.yml, the pre-commit hook of
                   lefthook in this clone); init adds what is missing, hooks:install the hook; then what
                   this checkout lacks to run the project, read without network: the running Node against
                   engines.node and .nvmrc, node_modules installed since the lockfile last changed, each
                   package of the kit installed at the version of this CLI, the submodules initialised;
                   each with its fix; --strict exits 1 while something is missing or the checkout cannot
                   run the project, never for a hook this clone has not installed, a Node .nvmrc does not
                   name or a lockfile changed since the install
  lint             the ESLint of the project (lint and ci:lint run it): fails on an error, and on a warning
                   as on an error, but on one of a rule of the kit in transition, a new rule that becomes an
                   error in the version it names, whose warnings are listed apart; --format and --fix as ESLint
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, each row not done ready on the trunk (its dependencies done), ready
                   on a branch (the others briefed to a worker with commits ahead of its base) or waiting
                   (with the ids it waits for), a row that landed with a worker's branch but is not marked done,
                   and the TODO(domain), TODO(platform), it.todo and TODO(review) left in each context, and
                   each story or milestone whose rows are all done while markers of its own keep it open (see
                   story-check, whose git blame it runs on those markers only); --workers shows instead each
                   worktree holding .ddd-ts-kit/worker.json (branch, context, rows, base, commits ahead and
                   files changed counted from where its branch landed on the base when it was squash-merged
                   there (else from the merge base), commits behind, the commit it landed as, what merge-trunk
                   would leave conflicted now, dependencies not installed, its report), a state line (rows
                   committed, the row under way, files uncommitted, markers, last verify-slice, and the
                   worker-scope --resume command of a stopped one), then the contexts and the files more than
                   one worker holds
  sdk              the typed client of each document of the contract, a workspace package under
                   clients/<document> without runtime dependency: typed errors keyed by the error codes,
                   credentials per security scheme; records "sdk" in the config the first time, wires the
                   scripts (docs:generate regenerates it, docs:check compares it, ci:build builds it);
                   --check writes nothing and exits 1 while a client differs from its contract
  todo             those markers as file:line, in the project or in one context
  plan-waves       the rows of slices.md not done, of the project or of one context, in waves (wave 1: every
                   dependency done; wave n: the others in earlier waves), each wave cut into batches of one
                   owner, one or two rows on one aggregate, with the worker-scope command that briefs each,
                   the batches of a wave likely to touch the same files (same aggregate in Start with, or
                   unknown when it names none), the merge order and what runs before each merge (merge-trunk
                   --to-land); a cycle, a dependency on an unknown id or a row without owner is reported
                   alone, and exits 1
  story-check      whether a story or a milestone can close, <code> being the start of the ids of its rows
                   (M1 for M1.01, M1.02: the id without its last .<number>): every row of it done in
                   slices.md (the others listed with their status), and no marker of its own left
                   (TODO(domain), TODO(platform), it.todo, TODO(review)). A marker is attributed to
                   rows: those its text names (#M1.03 or M1.03, word-bounded), else those of the commit
                   that wrote its line (git blame, once per file; its Slice: trailer, else the row ids
                   its message names), else, not committed, those of .ddd-ts-kit/worker.json in a
                   worker's worktree. It is the story's own when it belongs to one of its rows,
                   wherever it is; a marker of a context of its rows that belongs to no row is its own
                   when no other open story has a row in that context, and is listed without blocking
                   otherwise (settle it or name its row in it); a marker of other stories' rows does not
                   block. --strict: every marker of its contexts blocks. Each blocker comes with why it
                   is its own, its file:line and its fix: handle it, or dismiss it by a decision record
                   (generate adr), then delete the marker. Reads only: exits 0 when it can close, 1
                   listing what keeps it open, 2 on a code no row carries or without slices.md
  acceptance       the acceptance scenarios of each story (test/acceptance/<story>.acceptance.spec.ts) against
                   its rows in slices.md and the criteria of docs/architecture/stories/<story>.md: the rows and
                   criteria each scenario names (#US5.02 AC1 in its title), the scenarios left to write
                   (it.todo), those wrapped in pending(...) of @ddd-ts-kit/testing/e2e until their code is
                   built, and what is inconsistent (no row, an unknown row or criterion, a scenario skipped,
                   a pending one whose rows are done, a locked one changed while its criteria were not);
                   --gate written: every slice row and criterion has a written scenario, none is left to
                   write, the acceptance is locked (before the code of the story); --gate passing: none is
                   pending either (before the story closes); exits 1 while a gate is not met, or, without
                   one, on an inconsistency. Never runs a test. --lock writes
                   test/acceptance/<story>.acceptance.lock.json, the fingerprint of each criterion and of
                   each scenario (pending(...), layout and comments aside), refused while a scenario is
                   left to write, or while a criterion changed, or a locked scenario changed while its
                   criteria did not, without a verdict "amend" of the acceptance-judge agent on that very
                   version (test/acceptance/verdicts/*.md, lines Story:, Subject:, Fingerprint:,
                   Verdict:, Reason:); a refusal wins; the verdicts become amendments of the lock,
                   listed for the owner to validate
  worker-scope     a git worktree on the branch build/<context> (by default .worktrees/<context>, see worktree),
                   cut from --base <ref> (by default the current branch, refused from a worker's worktree), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context; --rows <id,...>
                   briefs those rows of slices.md only, with their rules, the documents of their design and
                   the names that design cites the base does not have (see cited), and by default the first
                   batch plan-waves cuts for the context (one or two rows on one aggregate), a note naming the
                   next; a worktree it creates gets the clean install of the package manager (npm ci), its
                   time in the notes, unless --no-install; an existing worktree or branch that does not
                   contain the base is refused, with the merge-trunk that brings it in
  --here           worker-scope in the worktree of a story (.ddd-ts-kit/story.json): writes the scope of the
                   next agent in place, its base the base of the story, and prints its briefing; no
                   worktree, branch or install of its own; the agents of a story run one after the other
  story-scope      the worktree of one story, .worktrees/<story> on story/<story> cut from --base (by default
                   origin/main from the trunk, else the current branch, refused from the worktree of a
                   story), its .ddd-ts-kit/story.json and
                   its clean install; an existing one is kept and the story resumes there; refused when the
                   story is open in another worktree; names the other open stories and the contexts their
                   rows change
  worktree         the worktree of any other piece of work, .worktrees/<name> on work/<name> cut from --base
                   (by default origin/main from the trunk, else the current branch), and its clean install
                   unless --no-install; an existing one is kept; .worktrees/ lies in the main checkout,
                   whichever worktree it runs from, ignored by git and by the tools of the project; while
                   the .gitignore of a project started before does not hold it (init adds it), a worktree
                   opens next to the project, ../<project>-<name>; in a project whose config says
                   "worktrees": "required" (what init writes), the guard of the plugin refuses the code of
                   a context in the main checkout of the trunk, and in a worktree of .worktrees/ without
                   its own node_modules
  story            where a story stands, phase by phase: its specification and criteria
                   (docs/architecture/stories/<story>.md), its rows in slices.md, a design review section
                   per row not done (docs/architecture/reviews/<story>.md, ## #<id>), its acceptance written
                   and locked, its rows done, its acceptance passing, its trunk merged in, its ## Report; and
                   the next step; in the worktree of a story, the story is its own; --gate build exits 1
                   until the first four are met (the code may start: the guard of the plugin opens the
                   contexts), --gate close until all are
  stories          the stories open in the worktrees of the repository and where two of them meet: the
                   contexts the rows of both name, the files both worktrees change (committed or not), what
                   merging the branch of one into the other leaves to a person and what merge-trunk settles
                   (git merge-tree, nothing written); how far each is behind its base; from the worktree of a
                   story, the stories it meets; the guard of the plugin says it at session start and on a
                   write to a file another story changes
  --resume         worker-scope reads where the stopped worker of the context stands (its rows by their
                   Slice: trailer, the files of the row under way, the markers, its last verify-slice, its
                   report, its agent as the guard recorded it) and prints the message that resumes its agent
                   (SendMessage) or the briefing of a new one; creates and rewrites nothing; --fresh asks for
                   a new agent whatever the last one did; several worktrees of the context need --worktree
  verify-slice     closes a slice before its commit, in one run: the regenerate script, check on the files
                   changed since --since (new ones included), the test script for the context; then the
                   changed files past 300 of the 350 lines, the paths of the slice to stage (its context, an
                   end-to-end spec, a working migration, the derived files git tracks) and every other
                   changed path, left out and never to stage with it; the merges since --since, as
                   verify-merge checks them, reported without failing the slice in this version (a later
                   minor version fails it); exits 1 while a step fails; then the names the slice removes
                   that the design of a row not done still cites (never a failure); in the worktree of a
                   worker, the commit command with the trailer Slice: <row>, and
                   .ddd-ts-kit/verification.json for the conductor
  cited            the names the design of rows not done cites as code (paths, classes, Class.member) that
                   the code does not have: those the history of --base removed (with the commit and the
                   successor), the places the canonical tree refuses, and a name never there whose close
                   name of the same part arrived after the line was written; planned names stay silent.
                   The design of a row: its cells and rule lines in slices.md, a section of a document of
                   docs/architecture whose heading names it, a document that names it or that its rule
                   line links to. Default: every row not done, of the context when given, at the current
                   branch. --removed-since <ref>: the names a change removes, from the merge base to the
                   working tree, that such a design cites. Reads only, exits 0
  verify-merge     what the merges of a branch lost, read from git only: every merge commit since --since
                   (by default the base of .ddd-ts-kit/worker.json, then origin/HEAD, then origin/main) and
                   the merge in progress (its result: the index and the working tree), or one <commit>; a
                   squash commit takes --theirs <head of the branch it took in>. Errors: a line one side
                   added or both kept missing from the result (whitespace, a line laid out again, a move
                   to another file and imports merged into one statement aside), a file neither side
                   deleted gone from the result, a row of slices.md done on one side and no longer done or
                   gone, a test title or a spec file of one side gone, a migration of one side whose
                   description (name without number and working-) the result lacks, a conflict marker;
                   warnings: a line one side removed brought back, a line one side wrote where the other
                   changed the same lines or deleted the file (the merge chose), a line the merge replaced
                   by lines of its own. Derived files, files a tool says it wrote, migrations, lockfiles
                   and slices.md are left out of the lines. The base is --base, else the Merge-Base:
                   trailer of the merge, else git merge-base; entries of a Lost-Accepted: <file:line>,...
                   trailer are listed and never fail, nor what a later commit restored; silent and exit 0
                   without a merge, exit 1 on an error; --warn prints the same and exits 0, as the
                   pre-push hook of init runs it in this version (a later minor version blocks the push)
  merge-trunk      brings the trunk (--trunk, by default origin/HEAD then origin/main, never fetched) into the
                   branch as one merge commit computed from the branch's own diff: from the newest commit of
                   the branch the trunk holds (--since; else the commit whose patch, derived files,
                   migrations, slices.md, plan.md and lockfiles left out, is one commit of the trunk, on this
                   branch or a branch it shares commits with; else the base recorded for the worker when its
                   lines are on the trunk; else git merge-base). Settles derived files and drizzle-kit meta
                   (trunk side), generated regions of CONTEXT.md and the context map (trunk side), conflicts
                   inside generated registries (lines of both sides), slices.md row by row (the furthest
                   status), the stored-events lock by key, the lockfile (trunk side, installed again when
                   the branch changed package.json); the rest is left in a merge in progress git
                   understands, with what each side did (exit 1). Then, or on --continue: the drizzle
                   migrations of both sides replayed, on --to-land the working migrations renamed (knex,
                   Prisma, TypeORM; stop when both sides change one table), decision records renumbered,
                   regenerate, verify-merge on the uncommitted result (an error stops; --accept-lost records
                   a Lost-Accepted: trailer), and the commit of the merge's paths only, with the trailers
                   Merge-Base:, Trunk: and Landed:; any other changed path blocks it. --dry-run previews,
                   --abort undoes; refused (exit 2) on a dirty tree, another operation in progress, no
                   committer known to git, an unknown trunk, or a git older than 2.40 with a base git
                   would not compute
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --explain        check follows the violations with the reason of each rule they report, once per rule, as
                   explain gives it without its examples ("explanations" in JSON); with github and gitlab, each
                   annotation carries the reason of its rule, a pull request showing an annotation on its own
  --stored-events  docs records the shape of each version of the stored events in stored-events.lock.json,
                   never rewriting a recorded one but one recorded by 0.82.0 or earlier, recorded again as
                   the kit reads it now: run it once the shape of a version is the one to store; docs --check
                   fails while a declared version is not recorded, or recorded by 0.82.0 or earlier
  --sdk            init records "sdk" in the config and generates the clients with the project
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do`;
