# Stage 5: deploy

**Summary.** Three plays. *AI in the PR review loop*: every pull request gets the same review
passes, written as `REVIEW.md` at the root (bugs, security, compliance against the spec and the
plan; what *Important* means; nits capped; generated paths skipped), findings ranked, a human
approving through branch protection, the agent addressing comments on its own pull requests
and babysitting them to green, review findings feeding `CLAUDE.md`. *Hooks as approval gates*:
the gates the change process requires, each a hook that allows, asks or blocks, team hooks in
the repository and non-negotiable ones in managed settings, a block that explains itself.
*CI/CD integration*: `claude -p` for read-only judgment steps first, write steps behind the
existing gates, sandboxed jobs with scoped tokens, deployment through MCP tools tiered by
environment, rollback as the most rehearsed path. The kit holds a reviewer agent with a method
of its own, documented branch protection, and a pipeline that stops at the image. Six
proposals: the review policy as a file every reviewer reads (P14), optional review and triage
jobs in the pipeline (P15), a skill that takes a pull request to green (P16), code owners
generated from the contexts (P17), a production gate and a change reference on migrations as
hooks (P18), and a deploy and rollback guide (P19).

## AI in the PR review loop

**The playbook.** The managed Code Review service or `claude-code-action` in CI; `REVIEW.md`
written by the tech lead; findings never approve or block alone, branch protection asks a code
owner; `@claude` on a comment addresses it and pushes; a custom slash command sweeps the
unresolved comments and failing checks until the pull request waits only on approval; a
mistake flagged twice goes into `CLAUDE.md` as part of that review; once a month the lead rates
findings and caps nits. Separation of duties is preserved because the agent that wrote the
code cannot approve it. Measured by the time to first review (minutes) and the share of
comments resolved without a human touching the branch; defects caught before merge against
those escaping.

**The kit.** The `architecture-reviewer` agent, read-only, with a method (machines first, then
the fifteen signs tools cannot see, a verdict, blocking and non-blocking findings with the
`TODO(review)` line to write); the review focus per layer in the team workflow guide; the
markers tied to rows and `story-check`; the close phase of a story that runs the reviewer on
the branch; `branch-protection.md` and `merge-request-settings.md` with the commands to apply;
no code owners file (the guide says to write it by hand); no review in CI; no comment loop.

### P14. `REVIEW.md`, the policy every reviewer reads

**What.** `init` writes `REVIEW.md` at the root, from the kit's rules and the project's stack,
and the `architecture-reviewer` agent, the close phase of a story, a human reviewer and any PR
review bot (P15) read the same file:

```md
# Review instructions

## Passes
Tag each finding with its pass.
- Bugs: a wrong business rule, a state the aggregate can reach that it should not, an idempotent replay that is not, a failure path without a test.
- Security: a search not narrowed by the access scope, a field reserved to a permission that leaks in a representation, personal data in a log or an error, an error code not declared on its route, a tenant read outside the scope.
- Compliance: the diff against the design review of its row (`docs/architecture/reviews/<story>.md`), the acceptance of its story, the records of `docs/adr/`, and the rules (`npx ddd-ts-kit check --changed-since <base> --explain`).

## What Important means here
A violation of a rule of the kit, wrong behaviour, a broken boundary, a leak of data, an acceptance scenario changed outside a verdict. Naming and layout are nits unless a rule holds them.

## Cap the nits
At most five nits per review; the rest as a count. A nit that recurs becomes a line of `AGENTS.md` under `## Mistakes seen here` or a rule of `ddd-ts-kit.config.json`.

## Do not report
Generated files (the barrels, `openapi/`, `docs/integration/`, `.dependency-cruiser.cjs`, the generated sections of `CONTEXT.md`) and anything `npm run verify` already refuses.
```

The reviewer agent's prompt keeps its method and reads `REVIEW.md` as the policy on top of it;
a project edits the file (the `ask` list of P9 covers it, it holds a rule); `doctor` says when
it is missing.

**Why.** Today the review policy of a ddd-ts-kit project exists in one place no human reads and
no other host runs. The playbook's file makes the passes auditable (*the review policy is
applied to all PRs*), lets a team add its own pass (a brand rule, a data-classification rule),
and is the input of the PR bot of P15. For the kit's own goals, the *Compliance* pass is the
one that matters: it ties the diff to the story's design and acceptance, which the playbook
calls checking against `spec.md` and `plan.md`.

**Cost.** Small: a template, one paragraph of the agent, the guide. The French twin of the
guide quotes the file.

### P15. `--ci-extras claude-review` and `claude-triage`

**What.** Two opt-in extras of `init`, on the model of `codeql` (never installed by default,
recorded in `ci.extras`):

- `claude-review`: on GitHub, `claude-code-action` on `pull_request`, reading `REVIEW.md` and
  the story file the branch names, posting findings as a review that neither approves nor
  blocks; on GitLab, a job calling `claude -p` with the same prompt and posting a note through
  the API. Model access through the API key, or through Bedrock, Vertex or Foundry by the
  variables the action documents. The `gate` job does not need it.
- `claude-triage`: a step `if: failure()` of the pipeline, read-only (`Read`, `Grep`, the
  log), that writes a three-line triage (most likely cause, flaky or real) to the job summary
  and the pull request thread, as the playbook's example does.

The pipeline README documents both in *Free by default, paid on request*, with their cost (API
tokens per run) and the branch-protection rule that stays: a human approval.

**What it is not.** Not a merge decision. The playbook is explicit: *findings do not approve or
block a PR on their own*; a platform engineer who wants a threshold reads the severity counts.

**Cost.** Medium: two workflow templates per platform, parsed and `actionlint`-checked like
the others, not executed on the platforms by the kit's own CI (the README says so, as for the
rest).

### P16. The pull request taken to green

**What.** A skill `pull-request <number>` (or the last step of the story's phase 8 when the
owner asks): sweep the unresolved review comments and the failing checks of the pull request
with `gh` (or `glab`), address each in the worktree of the story (a comment that asks a change
the design review did not foresee becomes a `D<n>`; a comment that asks to weaken a check goes
through `deviation`), push, wait for the checks, repeat until the pull request is green and
waits only on the code owner; then report what was changed and what was declined and why. The
guard's rules of the story worktree apply throughout.

**Why.** The playbook's measure is *the share of review comments resolved without a human
touching the branch*. The story skill stops at `gh pr create`; the engineer then does the loop
by hand or in a new session that has lost the story's context.

**Cost.** Small: the skill is a loop over `gh pr view --json` and `gh pr checks`; the allowed
tools list is the story's plus `gh pr *`.

### P17. Code owners generated from the contexts

**What.** `contexts.<name>.owners` (a list of handles) and `platform.owners` in
`ddd-ts-kit.config.json`; `ddd-ts-kit docs` writes `.github/CODEOWNERS` (GitHub) or
`CODEOWNERS` (GitLab) between markers, from the table of the team workflow guide: each
context's tree to its owners, `shared-kernel/` to every context that imports it, `src/platform/`,
`main.ts`, the config, the pipeline files, `REVIEW.md`, `AGENTS.md` and `docs/adr/` to the
platform owners, a `published-language/` to its context's owners with its declared consumers
as reviewers in the pull request template. `docs --check` reports a stale file.

**Why.** The playbook's separation of duties rests on *branch protection requiring a code
owner's approval*. The kit already knows who owns what in principle (the guide's table) and
writes the file by hand, which drifts at the first renamed context. For a regulated team the
generated file plus the branch protection of `branch-protection.md` is the mechanical answer
to *who approved*.

**Cost.** Medium: a config key, a writer in `docs`, the check, `init --force` to add the
markers, the guide.

## Hooks as approval gates

**The playbook.** List the human gates that must survive (change management sign-off, release
authorisation, protected paths); express each as a hook that allows, asks or blocks; team hooks
in `.claude/settings.json`, non-negotiable ones in managed settings; a block explains itself
and names the route to approval; the example blocks a production deploy without
`RELEASE_APPROVAL`, exit code 2 with the message to the agent. Also: block edits to migrations
and infrastructure without a change ticket during the build. Measured by the time spent
waiting at each gate (from the OpenTelemetry export of hook decisions) and by gate violations
reaching production.

**The kit.** The `ask` list of `init` (push, publish, the rule and pipeline files); the guard
asks before a suppression, a skipped test or a change of the rules; the guard fails open and
is a guide, not a boundary, as the guides say.

### P18. A production gate and a change reference on migrations

**What.** With `init --agent-profile regulated` (P9), two hooks written to
`.claude/hooks/` in Node (the kit's language, no `jq` dependency), registered in
`.claude/settings.json`:

- `production-gate.mjs`, `PreToolUse` on `Bash`: a command that names the production
  environment of the project (`deploy`, `migrate`, `rollback` with the production target the
  project configures) is blocked unless `RELEASE_APPROVAL` names an approver and a change id;
  the message says who may set it and where the release checklist is.
- `change-reference.mjs`, `PreToolUse` on `Write|Edit` of a migration or of `docker/`: asks
  (not blocks) for a change reference, which the session records as a `Change: <id>` trailer
  of the commit of the migration; `story-check` reports a migration commit without it.

Both explain themselves, and the profile prints the managed-settings block
(`allowManagedHooksOnly`) that makes them non-negotiable where the platform team wants it.

**Why.** These are the two gates the playbook names for a regulated build; the kit's `ask` on
`git push` is weaker than both. Writing them once avoids every project writing a shell script
with `jq`.

**Cost.** Medium: two small scripts with tests (the guard's test file shows the pattern), the
profile, the guide.

## CI/CD integration and deployment

**The playbook.** Read-only judgment steps first; write steps behind the gates, arriving as
pull requests with no route to main; execution sandboxed with short-lived scoped tokens;
deployment, status and rollback exposed as MCP tools scoped per environment; autonomy tiered
(free in development, prepared and authorised in production); rollback a single command,
rehearsed in staging, because the maintain stage calls it. Measured by the share of pipeline
failures triaged without paging a human, and by the DORA measures.

**The kit.** A pipeline whose logic is npm scripts, a gate job, an image built and not pushed,
`db:migrate` named in the commands guide, `generate worker` and `generate service` for a process
apart. The kit stops at the image by design and says nothing of what follows.

### P19. A deploy and rollback guide

**What.** `docs/guides/deploy-and-rollback.md`, documentation only: what a ddd-ts-kit project
ships (the image, the migrations, the outbox relay and the workers as processes, the health
and readiness routes, the OpenTelemetry export); the order of a release (migrate forward
compatibly, deploy, relay); what a rollback of each piece means (an additive migration needs
none; a consumer that tolerates both worlds, as the team workflow guide already requires;
the outbox that replays); the three tiers of the playbook mapped on the project's environments;
deploy, status and rollback as one script each, exposed to the agent through an MCP server of
the platform team or through the `allow` list, never both; the production gate of P18; and
the rehearsal: rollback run in staging on a schedule, so that the loop of P20 can call it.
The `claude-triage` extra of P15 is the read-only first step the playbook recommends.

**Why.** Without this page a team that follows the playbook has to work out alone what the
kit's pieces mean for a release, and the maintain stage has nothing to call. It is also where
the kit says plainly what it does not do (no deployment tool, no MCP server shipped).

**Cost.** Small to medium: a page and its French twin, with the scheduling example as the
worked case.

## Measures of this stage

| Indicator | Playbook | Kit, computed by P23 |
|---|---|---|
| time to first review | minutes, from the PR metadata | from the report commit to the first review event, from the PR history |
| comments resolved by the agent | share without a human touching the branch | commits of P16's loop against commits by hand on the branch |
| escaped defects | caught before merge against found in production | `TODO(review)` and blocking findings settled on the branch, against fix stories (P11) opened later on the same rows |
| gate waits | time waiting at each gate, from the OpenTelemetry export of hook decisions | not computed by the kit; the sandbox guide points at the export |
| DORA | from the CI and deployment tooling | not the kit's: the guide names the four and where each comes from |
