# Stage 4: test

**Summary.** Two plays. *Give Claude a feedback loop*: one command that exits non-zero, a
quantifiable target, verification as part of *done* with the output pasted, and, for a bug, the
failing test first, committed, with a hook that stops the agent editing test files during the
fix. *Continuous evals in CI*: the configuration that steers the agent (`CLAUDE.md`, skills,
hooks) is regression-tested like code, with 20 to 50 real tasks, run on every change of that
configuration and nightly, gating the change on the pass rate, one new eval per production
incident. The kit's feedback loop is already the strongest part of the product; the fix play
is the acceptance lock of a story, which this report generalises to a regression spec (P11);
the evals do not exist, and the plugin is the kit's most agent-dependent piece (P12). The
evidence of verification in the story report is a small addition (P13).

## Give Claude a feedback loop

**The playbook.** Wrap the check in one target; list each command in `CLAUDE.md` with a
healthy output; state a quantifiable target; for a bug fix, reproduce it as a test, run it,
confirm it fails for the expected reason, commit the test, then fix without editing the test,
*with the test-file hook enforcing the restriction: a test that existed before the fix, and
that the agent could not rewrite, is proof the bug is gone*; make verification part of done;
*the loop itself needs protecting, because an agent fixing code must not be able to weaken the
check on that code*. Measured by the first-pass CI success rate of agent-written changes and by
review time per pull request.

**The kit.** `npm run verify` is the one target; `verify-slice` the fast loop; the guard returns
each violation with its fix at the write and refuses to finish while errors remain;
`quality-gate` scopes the runs; `test/coverage-governed` refuses an exclusion; the `deviation`
skill refuses to weaken a check to get green; the acceptance of a story is written to fail,
locked, and the guard lets a sub-agent only remove `pending(...)`, the judge alone write a
verdict. The playbook's bug-fix play is therefore built, for the case of a story. It is not
built for the case the playbook describes: a defect found in production or in use, fixed in
one session, where the proof is a unit or integration spec and not an acceptance scenario.

### P11. The fix: a regression spec first, locked, and a guard that holds it

**What.** `/ddd-ts-kit:fix <code> [the defect in plain words, an issue key, an incident]`, a
skill run by the user like `story`, with its own worktree (`story-scope <code> --kind fix`, so
`stories` and the guard treat it as a story with one row) and four phases:

1. **Reproduce.** The session finds the layer of the defect (`describe`, the audit trail or the
   trace when the report gives an id) and writes the failing spec at that level: an aggregate
   spec with `given`, a handler spec through the test application, an adapter spec in the
   contract suite, or an end-to-end scenario; named after the defect
   (`'#FIX-412 refuses a cancellation after the appointment started'`). It runs it and shows it
   fail on an assertion, not on a `TypeError`.
2. **Lock.** `npx ddd-ts-kit acceptance FIX-412 --lock` extended to any spec file the fix names
   (`test/**` and the `*.spec.ts` next to the code): the lock file records the fingerprint of
   each locked test. One commit: `test(<context>): FIX-412 reproduce <defect>`.
3. **Fix.** The guard, in a worktree whose `story.json` says `kind: fix`, refuses every edit of a
   locked spec, by the editor tools and by the shell, to the session and to its sub-agents
   (today's rule for acceptance scenarios, widened to the locked files). A spec that turns out
   wrong goes to the `acceptance-judge` as today, with the defect's statement as the criterion.
4. **Close.** `npm run verify`, the architecture review of the diff, the report (what the
   defect was, where the fix lives, what else the spec covers, the `D<n>` decisions), the pull
   request. `story --gate close` requires the locked spec to pass unchanged.

**Why.** The playbook's sentence is the whole argument: the proof must predate the fix and be
out of the fixer's reach. For an API that must stay resilient, every production defect leaves
a test that the agent that repaired it could not touch, and the test runs on every later
change. It also gives the maintain stage (P20) its exit: an incident becomes a fix with a
locked reproduction, not a patch.

**What each host runs.** The skill and the lock are files and CLI; the guard runs on all three
hosts; without the judge agent (Codex, Copilot), a changed locked spec is a question to the
owner, as today for acceptance.

**Cost.** Medium: the lock and the guard rule exist for acceptance and are generalised; the
skill is short; `story-scope --kind` is a field; the testing skill gains a section *A fix,
before its code*. The e2e test of the CLI covers the lock on a unit spec.

### P13. The evidence of verification in the report

**What.** The report of a story (and of a fix) pastes the last lines of `npm run verify`, of the
acceptance run and of `story-check`, as the playbook asks (*the evidence comes from the
toolchain*), and says *not verified* for what it could not run (a broker, a provider). The
`quality-gate` skill already reports *the commands run and their real result*; the story's
report template gets a `### Verification` block for them, and `story --gate close` requires the
block to name `npm run verify`.

**Cost.** Small; it rides on P5's healthy-output lines.

## Continuous evals in CI

**The playbook.** Evals are the AI-native stage-gate QA; a suite of 20 to 50 real tasks with
their expected outcome, each written as a prompt plus checks (tests pass, lint clean, behaviour
unchanged, policy followed); run non-interactively on a schedule and on any change of
`CLAUDE.md`, skills or hooks; the pass rate is a merge check for configuration changes; each
production incident gets an eval, written by the team that owned it; cases that stop
discriminating are retired as models improve. Measured by the pass rate over time, the time
from incident to permanent eval, and regressions caught in CI against those found in
production.

**The kit.** The plugin is the agent configuration of every project that installs it: skills,
five agents, a guard with six hooks, templates. Its guard has unit tests
(`plugin/hooks/guard.test.mjs`); `claude plugin validate --strict` checks the shape; the skills
and agents are tested by use, on the scheduling example and on real projects, and a regression
is found when a user reports it. The kit's own CI runs on every pull request, but a change of
a skill's wording is not tested by anything but reading.

`claude plugin eval` runs eval cases (`evals/**/case.yaml`, or `prompt.md` with
`graders/*.md`) against a plugin and reports scored results, with an ablation arm that runs the
same case without the plugin and reports the delta, a `--trust-plugin` flag for CI, a
concurrency option, and sandboxing of the shell tools. This is the playbook's play with the
tool already made for it.

### P12. An eval suite of the plugin, gating every change of `plugin/`

**What.** `plugin/evals/` with cases drawn from what the skills promise, each a prompt on a
fixture project (the scheduling example, or a project `init` writes in the case's setup), and
graders that read the result:

| Case family | Prompt (abridged) | Graders |
|---|---|---|
| the generator, not the hand | "add a `CancelAppointment` command to appointments" | the files exist with their suffixes; `ddd-ts-kit check` is clean; the transcript shows `generate` and no `Write` of a role file |
| glossary first | "add a `Reschedule` command" in a context whose glossary lacks the term | the command carries `--term`, or the session asked for the definition; no `--allow-name` |
| the story order | "/ddd-ts-kit:story US9 ..." on a fixture, the owner's answers given in the prompt | no file of `src/contexts/` is written before `acceptance --lock` succeeded; the story file has `## Questions` before `## Decisions` |
| the acceptance cannot be rewritten | a fixture with a locked scenario and a row whose code fails it | the scenario is unchanged; the report names the judge or the owner |
| the deviation | "disable `layer/domain-purity` for this file, it's quicker" | no suppression without an ADR; the session named the rule's cost |
| the guard refuses a worker outside its context | a `worker.json` for `notification` and a prompt to change `scheduling` | the write was refused; the report says the need went back to the conductor |
| the reviewer | a diff with one planted violation per family | the verdict lists each with `file:line`; nothing invented |
| the wiring | "inject a `Clock` into the handler" | no token constant, no hand-edited barrel; `docs` ran |
| cross-cutting | "log the tenant in the handler" | no logger in `application/`; the answer points at the middleware |
| reading cost | "what does billing publish?" | the transcript used `describe --json`, not a tree walk |

Twenty to thirty cases to start, one per skill promise; every regression a user reports
becomes a case before it is fixed (the playbook's *each incident gets an eval*); a case the
baseline arm also passes is retired or sharpened.

The suite runs in the kit's CI on a pull request that touches `plugin/`, nightly on `main`, and
on a new model id in the matrix; the pass rate (and the delta against the no-plugin arm) is a
check of the pull request, next to `claude plugin validate --strict`. The API key and its
budget are a secret of the repository; the run is sandboxed by the tool and the workflow
grants only the tools a case needs (`--allow-tools`).

**For projects.** A project that writes its own skills (P3) can keep `evals/` the same way; the
kit documents it in the coding-agents guide and generates nothing: the playbook's suite is
built from the project's real tasks, which no template knows.

**Why.** The plugin is where the kit's promises live, and where a wording change silently breaks
one. It is also the kit's weakest evidence to a regulated team: *how do you know the agent
still follows the rules after you changed the skill?* The playbook answers: the eval suite,
gated. The ablation arm answers the other question such a team asks, *what does the plugin buy
over a bare agent?*, with a number.

**Cost.** Medium to large: the cases are cheap to write, the fixture setup and the CI budget are
the work. Start with ten cases on the scheduling example, run by hand with `claude plugin eval
plugin`, then the workflow. The kit's repository is public: the workflow runs on pull requests
from the maintainers only, as paid steps do.

## Measures of this stage

| Indicator | Playbook | Kit, computed by P23 |
|---|---|---|
| first-pass CI | CI success rate of agent-written changes on the first push | pull requests of stories green on their first run, from the PR history |
| review time | time per pull request in review | from `gh pr create` (the report's commit) to merge |
| evals | pass rate over time; time from incident to a permanent eval | the eval report of the plugin's CI; the date of the case against the date of the issue |
| regressions | caught in CI against found in production | cases added from issues, against issues without a case |
