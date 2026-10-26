**English** · [Français](generated-project-families.fr.md)

# Proposal: the families that generate projects, in the pipeline and on a workstation

**Summary.** The jobs of the pipeline that generate projects and hold each one to its own gate
(the four end-to-end shards, the generated projects installed for real on npm and pnpm, the
import alias at run time, the example application and the copy of the example where every rule
is broken once) took 70 percent of a pull request run and 79 percent of a trunk run on
2026-10-26, and they grow with the templates: the end-to-end shards went from about 2,350 to
3,450 runner seconds in two days, the longest of them from about 740 s to about 1,200 s, while
the runnable stacks grew from 43 to 48. This page measures them from the API and the logs of 387
runs of the pipeline and from one generated project at a time on the workstation, lists what is
generated, installed or checked more than once, and ends with a plan of pull requests in order of
gain per effort. The short version: one job outside these families, the mutation reading of a pull
request, ran a full Stryker run on every pull request because the report it meant to reuse was
never written (fixed on this branch, one line); the selection by stack of #260 never narrowed a
run (104 of 104 pull requests that integrate every package ran every stack); the two sweeps of
`init` alone over the 48 runnable stacks are a third of the end-to-end time; the proven stacks
are generated and installed twice; and the shards are balanced on figures of 2026-10-23 that
have doubled. A pull request run can drop from about 7,700 to about 4,700 runner seconds and its
wall time from 28 to about 16 minutes, if the maintainer accepts what a pull request would then
prove and what it would leave to the trunk and the night ([decisions](#what-a-pull-request-must-still-prove)).

## Status (2026-10-26)

**Studied; one line built.** The [study of 2026-10-23](build-and-test-velocity.md) already
folded jobs, narrowed the families of a pull request, split the alias run and balanced the
shards; its section on the tools of the oxc-project (pull request #410) found that about 6,300
of the 8,300 runner seconds of a trunk run go to these families, and that a faster linter would
save at most 3 percent of them. This page takes those families as its subject. The only change
it makes is the line of the [first lever](#1-the-mutation-reading-reads-the-report-of-the-night),
in a commit of its own; every other lever is a pull request of the [plan](#the-plan).

## The question

What do the families that generate projects cost, per run and per day, on a pull request, on the
trunk and at night; what in them is done more than once; what can a pull request skip or leave to
the trunk and the night without losing what it has to prove; and what keeps a workstation shared
by several agents alive while it runs them?

## Method

The indicators are those of the [velocity page](build-and-test-velocity.md#method-and-indicators):
wall time, CPU time, peak memory of the process tree, queue time, selection rate.

- **The pipeline.** The API of GitHub Actions for the 387 completed runs of the CI workflow from
  2026-10-24 to 2026-10-26 (285 of pull requests, 100 of the trunk, 3 nights and a run on
  demand): every job with its duration (`completed_at` minus `started_at`), its queue
  (`started_at` minus `created_at`) and its steps. The tables of today are the successful runs of
  2026-10-26 (35 of pull requests, 17 of the trunk, one night), because the families grew during
  the three days ([Growth](#growth)). The per-file durations come from the logs of the four
  shards and of the other families in 16 runs of 2026-10-26 (8 of the trunk, 8 of pull requests)
  and of one trunk run of 2026-10-24. Runners: `ubuntu-26.04`, 4 vCPU.
- **The pull requests.** The 120 pull requests merged from 2026-10-23 17:22 to 2026-10-26 14:38,
  their files run through `select` of `pipeline/monorepo/affected-packages.mjs` and through the
  rule of `reachedBy` in `packages/cli/test/e2e/stacks.ts`, to see what the selection does on real
  changes.
- **The workstation.** 20 cores, 32 GB, Node 24.22.1, npm 11.19.1, the packages built. One
  generated project at a time, each command under `nice -n 10`, its wall time, its CPU time
  (user and system, `/usr/bin/time`) and the resident memory of its process tree summed every
  200 ms; the load average of the last minute recorded before each command (1.2 to 11.9: other
  agents shared the machine). The project is the one `initAloneIsGreen` makes (the default stack,
  two contexts asked of `init`, the kit copied in as `installAsPublished` does), its steps run as
  the helper runs them, then one project installed for real on npm as `installForReal` does, with
  an empty cache of npm and with a warm one. No spec suite was run whole. The raw figures are in
  [generated-project-families.csv](generated-project-families.csv).

## What the families cost today

### Per run

Median runner seconds of each job in the successful runs of 2026-10-26:

| Job | Pull request | Trunk | Night |
|---|---|---|---|
| End-to-end tests, shard 1, 2, 3, 4 | 593, 758, **1,195**, 968 | 564, 738, **1,191**, 984 | 415, 902, 1,234, 731 |
| Generated project on npm | 784 | 748 | 988 |
| Generated project on pnpm | not run (the release only) | 566 | 703 |
| Import alias at run time, Node 24 / Node 22 | 521 / not run | 511 / 461 | 530 / 438 |
| Example application | 400 | 393 | 322 |
| Every rule broken once in a copy of the example | 171 | 173 | 173 |
| Pairwise stacks, first migrations on PostgreSQL | not run (the release only) | not run | 118, 199 |
| **The families together** | **5,390 (70 %)** | **6,329 (79 %)** | about 6,800 |
| Mutation score of the change, on the example | **1,133** | not run | |
| Unit tests, Node 24 with coverage / Node 22 | 451 / 356 | 720 / 627 | 764 / 547 |
| The other jobs (install, checks, lint, architecture, integration, security, the Codecov upload, the Oxlint trial) | about 460 | about 750 | about 720 |
| **A whole run** (median of the runs, not the sum of the medians) | **7,685** | **8,023** | 11,747 (with the night's mutation run, 1,448, and the arm64 trials, 1,513) |

Read: on a pull request the families are 70 percent of the run and the mutation reading another
15 percent; on the trunk the families are 79 percent, two of their jobs (pnpm, alias on Node 22)
running only there. Each family job spends 17 to 20 s on its setup (checkout, the dependencies
and the build restored from their caches); the rest is the spec run.

### Over three days

The 387 runs took 638 runner hours, 213 a day, for a limit of 20 jobs at a time:

| Where | Runner hours | Share |
|---|---|---|
| End-to-end shards | 254 | 40 % |
| Generated projects on npm and pnpm | 69 | 11 % |
| Import alias at run time | 54 | 8 % |
| Example application, copy of the example | 34, 15 | 5 %, 2 % |
| **The families** | **426** | **67 %** |
| Mutation reading of pull requests | 62 | 10 % |
| Unit tests, both Node lines | 87 | 14 % |
| Everything else | 63 | 9 % |
| ... of which pull request runs that succeeded, were cancelled, failed | 309, 98, 50 | 48 %, 15 %, 8 % |
| ... of which trunk runs, night runs | 171, 11 | 27 %, 2 % |

Read: a merged change costs about 2.5 runs of its pull request and one run of the trunk. The
**83 cancelled pull request runs** (a newer push to the same pull request) lived a median of
637 s, long enough for the families to start: they burnt 61 runner hours of families, 10 percent
of everything, for no verdict. The 100 trunk runs (44 of them started less than 25 minutes after
the previous one) cost 15 times what the nights cost.

### The critical path of a pull request

On 2026-10-26 a successful pull request run took a median of **1,672 s** from its creation to its
last job (p95 3,065 s). The last shard ended at a median of 1,499 s, the mutation reading at
1,542 s: on the three days, the mutation reading was the last job of 88 of 160 successful pull
request runs, the gate the last of the others. The install job takes 32 s; each family job then
waited a median of 60 to 260 s in the queue (p95 760 to 1,900 s on that busy day) before its 17 s
of setup. Over the 63 hours observed, 18 or more jobs ran 33 percent of the time and 20, the
limit of the plan, 17 percent of it (the nights included, when nothing runs).

So two jobs set the wall time of a pull request today, each about 25 minutes from the creation of
the run: the third shard (1,195 s of run) and the mutation reading (1,133 s). Shortening one
alone moves the median little.

### Growth

| Trunk run | Runnable stacks | Seconds per stack of `init` alone | The four shards | Longest shard |
|---|---|---|---|---|
| 2026-10-24 00:18 | 43 | 7.4 (no context), 8.7 (two contexts) | 2,328 | 743 s |
| 2026-10-26, 16 runs | 48 | 13.8 | 3,450 | 1,194 s (median) |

Read: in two days the stacks grew by 12 percent and the cost of each by 60 to 90 percent, as the
templates grew (procedures, Nest controllers, Passport, the append-only audit, the jobs of the
platform). The families scale with the number of stacks times the size of a generated project;
a constant factor won on a tool is eaten in days, a selection is not.

### Per spec file

Medians of the 16 runs of 2026-10-26, in seconds of a runner (the files of a shard run one after
the other; the other families run two files at a time):

| Spec file | Family | Median | What it does |
|---|---|---|---|
| `first-minute-no-context.spec.ts` | shard 4 | **664** | `init` alone on the 48 runnable stacks, installed as published, the whole gate |
| `first-minute-two-contexts.spec.ts` | shard 3 | **661** | the same with two contexts asked of `init` |
| `coverage-gate.spec.ts` | shard 2 | 519 | the 9 proven stacks and the stack of the example, every kind generated, installed, the specs run four times with coverage |
| `first-minute-proven.spec.ts` | npm, pnpm | 411 | 8 proven stacks installed for real, `verify` four times each |
| `proven-stacks.spec.ts` | shard 1 | 362 | the 9 proven stacks, every kind generated, installed, the whole gate |
| `alias-runtime.spec.ts`, `alias-runtime-second-half.spec.ts` | alias | 351, 326 | 57 cases generated, compiled, started under node, tsx and vitest |
| `preset-identity.spec.ts` | shard 3 | 303 | 6 flavours of the identity preset |
| `package-managers.spec.ts`, `first-minute.spec.ts`, `first-minute-js.spec.ts` | npm, pnpm | 224, 216, 135 | installs for real, the quick start of the README |
| `first-class.spec.ts` | shard 4 | 208 | the stack of the example on three brokers |
| `typecheck.spec.ts` | shard 2 | 130 | every stack generated and type-checked against the sources |
| `rpc-procedures.spec.ts` | shard 2 | 122 | oRPC and tRPC on the four servers and Nest |
| `zero-violation.spec.ts`, `formatted.spec.ts` | shards 2, 4 | 57, 56 | every stack generated, checked, formatted; **also run by both unit jobs** |
| the 20 other files | | 2 to 74 each, 527 together | |

The table of `pipeline/monorepo/e2e-shards.mjs` still holds the seconds of 2026-10-23
(`first-minute-two-contexts` at 322, `first-minute-no-context` at 312, `coverage-gate` at 328):
the shards now end at 477, 875, 1,194 and 961 s of spec run, the third 2.5 times the first.

### One generated project, step by step

The project of `initAloneIsGreen` (the default stack, two contexts), twice:

| Step | Wall | CPU | Peak memory of the tree |
|---|---|---|---|
| `init` | 0.34 to 0.39 s | 0.4 s | 0.09 GB |
| the kit copied in (`installAsPublished`, 85 MB per project) | 0.29 to 0.31 s | 0.3 s | 0.06 GB |
| `eslint --print-config`, `check --json`, `depcruise-config --check` | 1.2 s together | 1.7 s | 0.20 GB |
| **ESLint, no cache** | **3.04 to 3.05 s** | **6.2 s** | 0.63 GB |
| dependency-cruiser | 0.46 to 0.62 s | 0.6 s | 0.17 GB |
| knip, then knip again for its remarks | 0.54 to 0.66 s, then 0.45 to 0.47 s | 1.4 s | 0.16 GB |
| **the specs (Vitest, half the cores)** | **2.32 to 2.36 s** | **5.0 s** | **1.01 to 1.13 GB** |
| the compiler, `build-aliases`, `docs --check`, the events and OpenAPI checks | 1.4 s together | 2.6 s | 0.25 GB |
| **the project** | **10.2 to 10.6 s** | **18.5 s** | **1.1 GB** |

A project installed for real on npm, the default stack, the kit from its tarballs:

| Step | Wall | CPU | Peak memory |
|---|---|---|---|
| `npm pack` of the 26 packages, one after the other (`packedKit`, once per spec file) | 12.4 s | 16.8 s | 0.23 GB |
| `npm install`, cache of npm empty (816 MB downloaded into it) | 145.5 s | 36.0 s | 0.53 GB |
| `npm install`, cache warm | 10.7 s | 19.1 s | 1.19 GB |
| `npm ci` right after (`installForReal` runs both) | 7.6 to 8.2 s | 11.1 to 12.5 s | 1.0 to 1.07 GB |
| `npm run verify` | 10.5 to 13.3 s | 20.2 to 22.7 s | 1.19 to 1.37 GB |

Read: a cold ESLint is 29 percent of the wall and 33 percent of the CPU of a project, the specs
22 and 27 percent; the rest is a dozen short processes. A runner takes about 1.3 times these
seconds (13.8 s per stack against 10.4 s). The second install of each real project, `npm ci`,
is a quarter of its cost on a warm cache; its packing of the kit, done again by each of the four
spec files of the job, costs more than one install. The empty cache is what the first project of
a runner meets; the link of this workstation to the registry is slower than a runner's, so the
145 s are an upper bound.

## What is done more than once

- **The proven stacks, twice.** `proven-stacks.spec.ts` and `coverage-gate.spec.ts` each generate
  every kind on the same 9 stacks and copy the kit into each (`scaffoldEverything` then
  `installAsPublished`); the first runs the specs once, the second four times with coverage
  (`test:coverage`, `ci:test:unit`, `ci:test:integration`, then again with one spec removed).
  881 s of a run, of which one generation and two spec runs per stack are repeats.
- **The matrix of stacks, eight times per trunk run.** `zero-violation`, `formatted` and
  `typecheck` generate every one of the 54 stacks, each on its own; the alias runs generate 57
  cases on each Node line; the two `first-minute` sweeps run `init` on 48 of them. With the two
  unit jobs, which run `zero-violation` and `formatted` too, a trunk run generates the matrix
  about ten times. Generating is cheap (under a second a stack); what is repeated at a cost is
  the gate run on each, and `zero-violation` and `formatted` are the same files in the unit jobs
  and in the shards (113 s of shards, plus their share of each unit job).
- **knip twice per project of `init` alone** (`expectNoFinding`, then again for its remarks):
  0.5 s of 10.4, 96 projects a run.
- **The packing of the kit**, once per spec file of the managers job instead of once per job:
  four times 12 s here, more on a runner.
- **Two installs per real project**: `npm install` writes the lockfile, `npm ci` proves a pipeline
  accepts it. The proof is `package-managers.spec.ts`'s to make; the first-minute files repeat it
  on every project.
- **`verify` four times on each first-minute project**, after `init`, after each context and
  after the first use case: 16 runs of the whole gate on the npm job of a pull request, each
  reinstalling nothing but linting, testing and checking the whole project.
- **The whole Stryker run of the example on every pull request** (the next section).
- **The same commit, twice.** A merged pull request is run again on the trunk, whole, with the
  two jobs a pull request does not run; a pull request whose newer push cancels its run pays the
  families of both.

## The levers

Each lever below gives its gain in runner seconds of a pull request run and of a trunk run, its
effect on the wall time of a pull request, on the workstation where it applies, and its risk:
what a pull request would no longer prove before its merge. Figures marked "estimated" are
derived from the per-file and per-step medians above, not measured after the change.

### 1. The mutation reading reads the report of the night

**What happens.** The job "Mutation score of the change, on the example" (pull request #278)
downloads the artifact of the last night and runs Stryker with `DDD_TS_KIT_MUTATION_SINCE`,
which turns on its incremental mode with `reports/mutation/incremental.json`. The night runs without that variable, so incremental mode
is off and Stryker never writes that file: the artifact holds `index.html` and `mutation.json`
only, and every pull request since 2026-10-24 logged "No incremental result file found ..., a
full mutation testing run will be performed": 2,412 mutants, 22 minutes 46 s on #406, a pull
request that touched no file of the example.

**The fix.** The json report and the incremental file are the same object (both are the report
Stryker hands its reporters, `onMutationTestReportReady`). Copied to `incremental.json` before the
run, the night's `mutation.json` was read back on the workstation: "2012 of 2412 mutant result(s)
are reused" (the 400 others are the static mutants and the refusal texts the config leaves out),
the run spent its time in the dry run of the 1,121 tests, 70 to 128 s at the concurrency of a
runner. On a runner the dry run of the 1,121 tests took 112 s.

**Gain.** About 990 runner seconds per pull request run (1,133 s to about 140 s), 13 percent of
it; the mutation reading stops being half of the critical path. **Built on this branch**: one
line of `.github/workflows/ci.yml`, in its own commit. The same gap ships to every project `init`
writes (the mutation jobs of `templates/pipeline/github/workflows/ci.yml.tpl` and of the GitLab
template), where the fix belongs in `governedMutation` of `@ddd-ts-kit/testing` or in the
templates: the first pull request of the plan. Skipping the job when the change touches no file
of the example would save the remaining 140 s on most pull requests.

**Risk.** None: the floor is the night's, the reading stays a reading.

### 2. The shards balanced on today's seconds, the two sweeps split

The table of the shards dates from 2026-10-23 and its two largest files doubled since. Balanced
on the medians above, with `first-minute-no-context` and `first-minute-two-contexts` each split in
two halves as `alias-runtime` was (every other stack), the four shards hold about 875 s each.

**Gain.** About 320 s of wall time on every pull request and trunk run (the third shard, 1,195 s,
to about 875 s), no runner second. A script that writes the table from the json reporter of the
last trunk run (or that warns when a shard drifts by more than a fifth) keeps it from drifting
again. **Risk:** none.

### 3. A covering set of stacks on a pull request, every stack on the trunk and at night

The selection by stack of #260 keeps a stack when a flag of it names a package the change reaches
and every stack when a package every project is built with is reached. On the 113 pull requests
of the three days (the releases aside): 9 changed documents only; **104 reached `cli` or another
package of that list and ran every stack**; none was narrowed. `pipeline/`, `plugin/`, `docs/` and
`examples/` count as `cli`, and 63 of the 104 touched templates or generators, which do reach
every stack. A selection by path cannot do much better: only 6 of the 104 touched nothing a
generated project is made of.

A selection by value can. Over the 21 flags of the 48 runnable stacks, a greedy cover keeps **16
stacks in which every value of every flag appears at least once**. On a pull request, the two
sweeps of `init` alone and the alias cases run on those 16 (plus the three spellings with `.js`);
the trunk and the night keep the 48 and the 57, and the pairwise job keeps the pairs at night.

**Gain (estimated).** The two sweeps 1,325 s to about 440 s, the alias job 521 s to about 230 s:
about 1,180 runner seconds per pull request run, and the critical path of the shards with them.
**Risk:** a break that only a combination of two values shows (a broker with a wiring style, say)
is no longer seen before the merge; the trunk run sees it within the hour, on every stack, and the
pairwise job at night. The cover is computed from `EVERY_STACK`, so a new value is covered on the
day it lands.

### 4. The proven stacks generated once

`proven-stacks` and `coverage-gate` merged into one file: one project per proven stack, whose
spec run is `test:coverage` (one run proves the specs pass and that every layer reaches its
floor), then the rest of the proven gate. The two runs of the pipeline split (`ci:test:unit`,
`ci:test:integration`) and the run with a spec removed stay on one stack on a pull request, every
stack on the trunk and at night.

**Gain (estimated).** About 400 runner seconds per pull request run (881 s of the two files to
about 480 s), about 300 per trunk run. **Risk:** on a pull request, the split runs of the
pipeline are proven on one stack, not ten.

### 5. Each generating spec in one family

`zero-violation.spec.ts` and `formatted.spec.ts` run in both unit jobs and in the shards. One
place is enough. Out of the unit suite, they leave the pre-push hook of every branch that reaches
`cli` (most of them): measured on the workstation under a load of 9 to 12, 49 s and 57 s of wall,
54 and 64 CPU seconds, 1.3 and 0.9 GB. Out of the shards instead, the shards lose 113 s.

**Gain.** Either about 113 runner seconds per run, or a share of each unit job (they are its two
longest files after the compile matrix) and 118 CPU seconds of each local push. **Risk:** none if
the unit jobs keep them on a pull request that reaches `cli`; the maintainer chooses where the
homogeneity guarantee lives.

### 6. The real installs, lighter

In the managers job: the kit packed once per job (a step before the specs, the folder passed by
an environment variable `packedKit` reads) instead of once per spec file; `npm ci` after `npm
install` only in `package-managers.spec.ts`, which is the proof of the frozen install; on a pull
request, the first-minute projects held to `verify` after `init` and after their first use case,
the two intermediate runs (after each context) left to the trunk and the night.

**Gain (estimated).** The npm job 784 s to about 500 s per pull request run (three packings of
about 25 s, seven `npm ci` of about 15 s, eight `verify` of about 20 s); the same proportion on
pnpm. **Risk:** a project red between its first context and its first use case is seen at the
trunk run, not before the merge. The sequence was added for a reported defect: the maintainer
decides.

### 7. The trunk keeps what a pull request runs; the night keeps the rest

The trunk runs pnpm (566 s) and the alias on Node 22 (461 s), which no pull request runs, at each
of its 25 successful runs a day. At night and on the pull request of a release they still prove
both.

**Gain.** About 1,030 runner seconds per trunk run (13 percent), 7 runner hours a day on the
traffic of the three days, and two jobs fewer against the limit of 20 at every merge. **Risk:** a
break on pnpm or on Node 22 is seen at 03:00 instead of within the hour, and still before any
release; the alias job joins the condition of the release pull request that pnpm already has.

### 8. No family on a draft pull request

The 83 cancelled runs burnt 61 runner hours of families in three days, a newer push arriving a
median of ten minutes after the run started. The families (and the mutation reading) skip a pull
request in draft (`github.event.pull_request.draft == false`, and `ready_for_review` among the
events of `pull_request`); an agent opens its pull request as a draft until its branch is final.

**Gain.** Up to 20 runner hours a day on the traffic of the three days, and the queue they caused.
**Risk:** none for what is merged (a pull request leaves its draft, then runs everything); one
more run when an agent forgets the draft. It asks the briefings of the agents to say so.

### 9. The workstation

What a generated project takes is small (1.1 GB at its peak, Vitest at half of 20 cores); what
restarts a desktop is several heavy runs at once: the pre-push hook of a branch that reaches
everything (6.8 to 7.3 GB, [velocity page](build-and-test-velocity.md#what-the-day-measured)), a
family run (two files at a time, about 2.5 GB), a Stryker run (2.6 GB at concurrency 4, twice
that at the default concurrency of 19 here), from several agents.

- One lock for the machine around the heavy commands outside a pipeline (`flock` on a file of
  the user's runtime directory, two holders at most): the unit step of the pre-push hook, the
  `ci:test:*` scripts and `test:mutation`. An agent that finds both places taken waits instead
  of adding 7 GB.
- `VITEST_MAX_WORKERS=2` in the scripts of the end-to-end families outside a pipeline, as the
  managers and alias scripts already set: the projects they generate then start two workers,
  not ten.
- Lever 5 takes two CPU minutes off each push that reaches `cli`.

**Gain.** A bound on the peak memory the tests of several agents reach together, not a shorter
run. **Risk:** an agent waits for the lock.

### Not now

- **A warm cache of npm or of the store of pnpm restored on the runner.** The first install of a
  job downloads what the templates name (816 MB of cache here); the others hit the local cache.
  The 145 s measured are a workstation's link, not a runner's; to measure in the pipeline before
  spending 1 GB of a cache of 10 GB.
- **Hard links instead of copies for the kit in each project.** 0.3 s and 85 MB per project; the
  96 projects of the two sweeps keep about 4 GB on the disk of a runner until their file ends.
  Worth it if a runner runs out of disk again.
- **A cache of the verdict of each stack, keyed by its content.** The key would have to hold the
  built output of every package a project installs, which nearly every pull request changes; the
  reasons the velocity page gave against remote caches hold.
- **Cancelling a trunk run when the next merge arrives.** 44 percent of trunk runs start within 25
  minutes of the previous one, but each commit of the trunk keeps its own verdict; lever 7 is
  the cheaper half.

## The plan

In order of gain per effort; each line is one pull request, measured before and after on the
indicators of this page (runner seconds per pull request and trunk run, wall time to the last job,
queue, the per-file seconds of the shards):

| # | Pull request | Runner s per pull request run | Runner s per trunk run | Wall of a pull request | Effort | Needs a decision |
|---|---|---|---|---|---|---|
| 1 | The mutation reading reuses the night's report: the line of this branch, then `governedMutation` or the two templates for every generated project, with a file of `changes/` | **-990** | 0 | the mutation job no longer last | one line built; a small product fix | no |
| 2 | The shards balanced on today's seconds, the two sweeps of `init` alone in halves, the table written from the last trunk run | 0 | 0 | **about -320 s** | small | no |
| 3 | A covering set of 16 stacks for the two sweeps and the alias run on a pull request; every stack on the trunk, pairs at night | **about -1,180** | 0 | with 2, the shards about 600 s | medium | **yes** |
| 4 | `proven-stacks` and `coverage-gate` merged, the pipeline split and the removed spec on one stack on a pull request | about -400 | about -300 | part of 3 | medium | **yes** |
| 5 | `zero-violation` and `formatted` in one family | about -113 or a share of both unit jobs | the same | small | small | **yes**, which family |
| 6 | Packing once per job, the frozen install where it is the proof, two `verify` per first-minute project on a pull request | about -280 | about -180 | the npm job about 500 s | small | **yes**, the intermediate states |
| 7 | pnpm and the alias on Node 22 at night and on the release pull request, no longer on the trunk | 0 | **about -1,030** | queue | one condition each | **yes** |
| 8 | No family on a draft pull request; the briefings of agents open drafts | up to 20 runner hours a day | 0 | queue | small, and a habit | **yes** |
| 9 | One lock for the heavy local commands, two Vitest workers in the local end-to-end scripts | 0 | 0 | 0; the workstation | small | no |

Expected, lines 1 to 7 together, on the traffic of 2026-10-26: a pull request run from about
7,700 to about **4,700 runner seconds** (-39 percent); a trunk run from about 8,000 to about
**6,400** (-20 percent); the wall time of a pull request from a median of 1,672 s to about **950
to 1,050 s** (the install, a median queue, then the longest job, which becomes the unit job on
Node 24 with coverage, 451 s median and 745 s p95, the npm job at about 500 s, the shards at about
600 s). The shards could then be three instead of four, one job fewer against the limit, for about
100 s of wall time. The queue is the indicator to watch: fewer runner seconds at the same traffic
should take the repository off its limit for most of the day, which only the runs of the following
days can say.

### Plan status

Built on `fix/families-quick`, one commit each (the gain is the page's figure, not yet measured
after the change):

- **Line 1, the templates.** The mutation job of the pull request or merge request that `init`
  writes (GitHub and GitLab, and the copies in `pipeline/` and `examples/scheduling`) copies the
  json report of the night to `incremental.json` before Stryker runs, as the CI of the kit does.
  Expected: the same -990 runner seconds per run of a project whose example is the size of this
  one, in proportion to its mutants; a file of `changes/` carries the step to existing projects.

- **Line 2, the shards.** The table of `pipeline/monorepo/e2e-shards.mjs` holds the medians of
  2026-10-26 and the four runners end at 870, 867, 870 and 873 s of spec run (they ended at 593,
  758, 1,195 and 968 s of job). The two `first-minute` sweeps are **not** split: each (664 and 661
  s) is shorter than a runner's share (870 s), so the balance is the same with or without a split
  and the longest runner does not get shorter by it. Expected: the third shard, 1,195 s, to about
  900 s of job (the setup of a job on top of 873 s of specs), about 300 s of wall time on every
  pull request and trunk run, no runner second. The drift of the table is not yet warned about.

## What a pull request must still prove

The levers that need a decision trade a proof before the merge for a proof within the hour (the
trunk) or by the morning (the night). The maintainer decides, line by line:

1. **Every value of every flag, or every stack?** With lever 3 a pull request proves that `init`
   alone is green and that the alias runs on a set of stacks where every value appears; a break of
   a combination is found by the trunk run of its merge.
2. **The intermediate states of the first minute.** With lever 6 a pull request proves the first
   minute (`init` and the install) and the first use case; the state with one context, then two,
   is proven by the trunk and the night.
3. **The split runs of the coverage gate**, on one stack before the merge, on ten after it.
4. **pnpm and Node 22**, off the trunk: proven at night and before each release.
5. **Drafts**: whether pull requests of agents start as drafts, and whether a draft runs anything
   beyond the static checks, the lint and the unit specs.
6. **Where the homogeneity guarantee runs**: `zero-violation` and `formatted` in the unit suite
   (every push of a laptop) or in the end-to-end shards (every pull request).

What a pull request keeps in every case: the whole gate of the 9 proven stacks, the real install
of the default and the heavy stack on npm, the quick start of the README typed as written, the
example and every rule broken in its copy, every stack generated, checked, formatted and
type-checked.

## Still to verify

- The duration of the mutation reading once the line of this branch reaches the trunk: expected
  about 140 s against 1,133 s, read from the first ten pull requests after it.
- The download time and the hit rate of a cache of npm on a runner, before the first item of
  [Not now](#not-now).
- The queue over a week once lines 1 to 7 are in, against the 33 percent of the time spent at or
  near the limit on these three days.
- The recall of the covering set: every failure the trunk run finds that the pull request did not,
  recorded with the pair of values that caused it.

## Sources

The API of GitHub Actions (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`, the logs of a
job at `actions/jobs/<id>/logs`) and `gh pr list --state merged --json files`, read on
2026-10-26; the figures of the workstation and the per-job and per-file medians are in
[generated-project-families.csv](generated-project-families.csv). Stryker: the incremental mode
(`incremental`, `incrementalFile`) and the json reporter of `@stryker-mutator/core` 10, read in
`dist/src/reporters/mutation-test-report-helper.js` and `json-reporter.js`, both writing the report
handed to `onMutationTestReportReady`.

## See also

- [Velocity of the build, the checks and the tests](build-and-test-velocity.md)
- [Test runners](../tools/test-runners.md)
- [Sandboxing coding agents](../guides/agent-sandbox.md)
- [Parallel work](../guides/parallel-work.md)
- The pipeline of this repository: [pipeline/README.md](../../pipeline/README.md)
