**English** · [Français](build-and-test-velocity.fr.md)

# Proposal: velocity of the build, the checks and the tests

**Summary.** The machines of the people and agents who work on this repository, and the free
runners of its pipeline, have become the bottleneck: a full unit run takes 9 GB of memory on a
laptop, a pull request waits up to seven minutes in the queue of GitHub Actions before its
longest jobs start, and every check runs on everything whether or not the change reaches it.
This page measures where the time and the memory go, tests the levers the tooling offers
(Vitest pools, isolation and selection; ESLint caches and threads; Oxlint with its type-aware
engine; the parallelism of the native compiler; npm against pnpm), reads what other teams
published about orchestrators (Nx, Turborepo, moon), package managers, test selection and the
limits of GitHub Actions, and ends with a plan in order of gain per cost. The short version: the
compiler is solved (1.8 s for the 26 packages), the wall clock of the pipeline is made of three
end-to-end families and of a queue, the memory of a laptop is made of 743 isolated workers and
of one spec file that compiles fixtures eleven times in a row, and no orchestrator would change
either; what helps is selection, splitting, caching the lint, and fewer jobs per run.

## Status (2026-10-23; the tools of the oxc-project measured on 2026-10-26)

**Built, lines 1 to 7, in one day; two trials run for a month.** Each line was a pull request of
its own, measured before and after on the indicators below; the figures of the day are in
[What the day measured](#what-the-day-measured). The French page and this one keep the study
as it was written, then what it became.

| Part | Verdict |
|---|---|
| 1. Fewer jobs per pipeline run, the heavy families narrowed on a pull request | **built** (#248): five gates folded into one job, the alias suite on one Node line and the generated projects on npm on a pull request; 24 jobs to 20 on the trunk, 23 to 17 on a pull request; the end-to-end shards and the alias runs held to the stacks a change reaches came with the pull request #260: a flag of a stack that names a changed package (an orm, a broker, a cache, a queue, a reporter, a logger, a storage) keeps it, a change of a package every project is built with keeps them all, the first stack stays so that every file runs something |
| 2. The compile matrix of five spec files run in parallel | **built** (#250): the modes of a file compile a few at a time, the six longest files start first; the longest file 84 s to 27 s in a full run, the unit job of the pipeline 571 s to about 490 s |
| 3. Half the cores outside a pipeline, the specs of the packages a branch reaches before a push | **built** (#252): the unit step of the hook 152 to 201 s and 9.3 to 11.5 GB, to 101 to 110 s and 6.8 to 7.3 GB on a branch that reaches everything, seconds on a leaf |
| 4. ESLint with its content cache, the type check of the specs in parallel | **built** (#253): `npm run lint` 36.5 s to 1.3 s when nothing changed, the cache dropped when the rules of the kit as built, the config or the lockfile changed (`pipeline/monorepo/lint.mjs`); the trunk writes the cache of the pipeline, a pull request restores it; `typecheck:tests` 5.1 s to 3.3 s; the projects `init` writes take the same cache in `ddd-ts-kit lint` and in their lint job with the pull request #262 |
| 5. The install cache | **built otherwise** (#254): the key already followed the lockfile and the manifests in it guard the lockfile, so the key stays; half the 10 GB were the caches of merged pull requests, now deleted when a pull request closes; 10,052 MB to 5,637 MB the day the workflow landed |
| 6. The heavy families run two files at a time, their one-file giant split (rewritten: the unit job stopped being the longest after line 2) | **built** (#255): the generated projects and the alias runs two files at a time with two workers each, `alias-runtime.spec.ts` in two halves, the end-to-end shards balanced on measured seconds (505 to 521 s each, from 352 to 715 s); on four cores the managers family 521 s to 308 s; two files at a time was tried on the shards too and timed the specs of a generated project out: they stay one at a time |
| 7. Oxlint with tsgolint and the rules of the kit as a JS plugin; arm64 runners | **in trial** (#256): the one rule that broke under the plugin API fixed (#257 repairs the stepdown rule on scripts, which Oxlint revealed), `npm run lint:oxlint` 6 s and 1.0 GB against 35 s and 3.0 GB, a job of the trunk and of the night beside ESLint; the unit specs and the third end-to-end shard on `ubuntu-26.04-arm` at night; verdicts after a month. Measured again on 2026-10-26 ([The tools of the oxc-project](#the-tools-of-the-oxc-project-measured-on-2026-10-26)): the plugin runs whole on this tree and the native rules are at parity (1,197 of 1,197 findings on a corpus, three true findings more), but three rules of the kit read what Oxlint does not give a JS plugin (the types, the parser), and `clean-no-commented-out-code`, on in this repository, reports nothing under it: not the gate before the plugin is fixed |
| Oxfmt, tsdown, oxc-transform, the module cache of Vitest kept in the pipeline | **not now** (2026-10-26): the format check takes 0.33 s, the build 2 s and runs once per state of the sources, the module cache wins 5 percent of the whole unit suite; nothing to win for a reformat, lost declarations or a 122 MB cache |
| pnpm for this repository | **not now**: 1 s instead of 8 s per install, behind the same cache restore; the filter it offers exists already |
| Nx, Turborepo, moon, Lage, Rush | **no**: nothing left to cache, the affected selection exists, a remote cache costs or exposes |
| Biome as the linter, bun test or node:test as the runner | **no**: types, native modules and coverage |

### What the day measured

The pipeline figures are medians over the runs of 2026-10-23, twelve runs of the trunk and 38 of
pull requests before the first line merged (18:10 UTC), eight and eight after; a single day on
shared runners, with other runs in the queue, so the differences under a fifth are noise, and
the trials of the seventh line keep measuring. The workstation figures are those of the sections
above, taken on a quiet machine. Two rows depend on what else ran: the queue of a job and the wall
time of a run follow the traffic of the repository as much as the plan. That traffic was not
lighter after: the runs launched per hour were 6 to 8 in the afternoon the figures of before come
from and 10 to 12 in the evening of after, each run with fewer jobs (about 170 and about 215 jobs
an hour), so the drop is not the traffic's; but one day cannot say how much of it is the plan's.
Those two rows are to confirm over several days of equal traffic; the others do not depend on the
queue.

| Indicator | before | after lines 1 to 6 |
|---|---|---|
| jobs per run, trunk and pull request | 24 and 23 | 20 and 17 |
| wall time of a pull request run, median and p95 (to confirm over several days) | 1,073 s and 1,687 s | 800 s and 1,294 s |
| queue of a job of a pull request, p95 and max (to confirm over several days) | 461 s and 879 s | 162 s and 438 s |
| wall time of a trunk run, median (to confirm over several days) | 1,248 s | 1,069 s |
| the unit job of the trunk (Node 24, coverage) | 571 s | about 490 s |
| the generated projects on npm (trunk) | 790 s | 648 s (one run) |
| the alias suite on Node 24 (trunk) | 624 s | 276 to 441 s (two runs) |
| the unit suite on the workstation, 20 cores and 4 workers | 88 to 104 s, 203 s | 81 s, 139 s |
| the longest spec file in a full run | 84 s | 27 s |
| the unit step before a push, wall and peak memory | 152 to 201 s, 9.3 to 11.5 GB | 101 to 110 s, 6.8 to 7.3 GB |
| `npm run lint` when nothing changed | 36.5 s | 1.3 s |
| the managers family on four cores | 521 s | 308 s |
| the cache of the pipeline | 10,052 MB, full | 5,637 MB, the caches of a closed pull request deleted |

What did not move: the four end-to-end shards (450 to 720 s on the one trunk run after the
sixth line, against 454 to 659 s before: their balance and the two-files-at-a-time of the other
families did not change their sum), and the lint job of the trunk, which writes the cache rather
than reading it (the pull requests read it).

## The question

Can the quality, the build and the control tools of the repository use less CPU and memory, run
on the parts a change reaches only, locally and in the pipeline, and would pnpm workspaces, Nx
or another system bring velocity at the same quality? The answer has to hold for a large
project with much parallel work: several people and several agents at once, on one machine and
on the free runners of a public repository.

## Method and indicators

Every figure of this page is one of these indicators, measured the same way, so that a later
change is compared on the same scale.

| Indicator | What it answers | How it is measured here |
|---|---|---|
| wall time | how long a person or an agent waits | `/usr/bin/time`, or the clock around the command; p50 and p95 over the runs of the pipeline |
| CPU time (user + system) | what a run costs on runners that are counted in minutes, and whether the parallelism oversubscribes | `/usr/bin/time` |
| peak memory of the process tree | whether a laptop swaps or restarts | the resident memory of every process under the command, summed once per second, at its peak |
| queue time | the wait before a job starts, the price of the limit of concurrent jobs | `started_at` minus `created_at` of each job, from the API of GitHub |
| selection rate and test recall | how much a narrowed run skips, and whether a failing test is still selected | the files a selection runs over the whole; the full run on the trunk and at night catches what a selection misses |
| findings parity | whether a faster tool finds the same things | the diff of the findings of the two tools on the same tree |
| cache hit rate | whether a cache pays for its restore | hits over runs, per cache |

The local measures were taken on 2026-10-23 on one workstation (20 cores, 32 GB, Linux, Node
24.22, npm 11.19), under `nice`, one command at a time, with the load of the machine recorded
every second. The workstation is shared with an editor and with other coding agent sessions:
three runs that overlapped a foreign load were discarded and taken again. A single run per
setting, not ten: the figures are indicative to about 10 percent, which is enough for the
decisions below, where the differences are of 1.5x to 50x. The figures of the pipeline are read
from the API of GitHub Actions for two runs of the trunk (2026-10-23, #241 and #242) and one
pull request run (#243). The sources of the other teams quoted in section 6 are listed at the
end; a figure published by the company that sells the tool is marked "vendor".

The repository on that day: 26 packages, 160,840 lines of TypeScript under `src`, 148,914 under
`test`, 743 spec files and 11,051 tests, a `node_modules` of 1.5 GB with 833 top-level entries,
280 commits over the last month.

## What the repository costs today

### On a workstation

| Step | Wall | CPU | Peak memory | Note |
|---|---|---|---|---|
| `tsc -b` of the 26 packages, native compiler, from scratch | 1.8 s | 11.9 s | 0.86 GB | 747% of one core |
| the same with TypeScript 6 | 13.0 s | 20.5 s | 1.67 GB | kept for the specs that compile fixtures both ways |
| `tsc -b` with nothing to do | 1.7 s | 8.7 s | 0.66 GB | the build info is read, the sources are checked again |
| `add-extensions` on `dist` | 0.3 s | | | |
| Biome, format check | 0.8 s | 4.8 s | 0.22 GB | |
| knip | 2.8 s | 3.8 s | 0.52 GB | |
| dependency-cruiser | 3.2 s | 4.7 s | 0.65 GB | |
| `npm ci`, cache of npm warm | 14.0 s | | 1.9 GB | |
| `vitest run`, everything | 88 to 104 s | | **9.3 to 11.3 GB** | two runs; 743 workers, one per file (section 4) |
| `vitest run --coverage`, everything | 152 s | **1,585 s** | | 26 CPU minutes: what a 4 vCPU runner pays |
| the nine `node --test` files of the architecture job | 72 s | | 0.3 GB | the guard, the skills, the scripts of the pipeline: most of that job |
| ESLint, everything | see section 5 | | | |
| type check of the specs (25 projects in a row) | see section 5 | | | |

The compiler is no longer a cost: the full build of the 26 packages takes less time than the
import phase of a single spec file. Everything that follows is about the lint, the tests and the
pipeline.

### In the pipeline

A run of the trunk has 24 jobs; its wall clock is 20 to 23 minutes. The jobs that end last, and
the queue they waited in before starting (run #242 of the trunk, then the pull request #243):

| Job | Run (trunk) | Queue (trunk) | Run (PR) | Queue (PR) |
|---|---|---|---|---|
| Generated project on npm | 790 s | 28 s | 834 s | **394 s** |
| End-to-end tests (4 shards) | 571 to 763 s | 90 to 112 s | 546 to 650 s | 241 to **454 s** |
| Generated project on pnpm | 653 s | 45 s | 644 s | 444 s |
| Import alias at run time (Node 22, Node 24) | 703 to 716 s | 2 to 74 s | 577 to 623 s | 225 to 296 s |
| Unit tests (Node 24, coverage floors) | 602 s | 3 s | 571 s | 23 s |
| Unit tests (Node 22) | 504 s | 96 s | 424 s | 131 s |
| Example application | 236 s | 47 s | 380 s | 370 s |
| the other 12 jobs | 3 to 159 s | 2 to 91 s | 2 to 170 s | 2 to 395 s |

Three things decide the wall clock, and none of them is a tool.

1. **The three families that integrate every package**: the generated projects on both package
   managers, the four shards of the end-to-end suite and the alias runs on both Node lines
   generate about 35 sample projects and run their whole pipeline (install, compiler, lint,
   tests, check). They take 10 to 14 minutes each, they are never narrowed on a pull request
   (only skipped when nothing but documents changed), and they set the floor of every run.
2. **The limit of 20 concurrent jobs** of the Free plan, shared by every run of the repository.
   On 2026-10-23 the repository ran 103 pipelines (72 pull request runs, 31 pushes), about 2,500
   jobs for a limit of 20 at a time: the queue of a job reached 454 s on a pull request, 112 s on
   the trunk. Parallel sessions that each open a pull request queue behind each other.
3. **The install cache is full**: 142 entries, 10.6 GB for a limit of 10 GB, of which 24 copies
   of `node_modules` at 330 MB each. The key of that cache hashes every `packages/*/package.json`,
   so each release writes two new copies (one per Node line), and a pull request writes its own
   next to the ones of the trunk. Eviction is hourly and by least recent use: a run that misses
   pays an install instead of a 15 to 20 s restore.

The jobs that are narrowed already work: on the pull request above, `affected-packages.mjs`
held the unit job to the packages the change reached, and the install job answered in 34 s
from the caches.

### Where the unit suite spends its time

The sum of the durations of the 743 files is 564 s for 104 s of wall clock: the suite runs 5 to
6 files at a time on average on 20 cores, not 20, because the longest files dominate the end
of the run. Per package, the sum of the file durations:

| Package | Files | Tests | Sum of file durations |
|---|---|---|---|
| cli | 267 | 3,749 | 272 s |
| kernel | 59 | 816 | 90 s |
| http | 47 | 611 | 29 s |
| aspects | 16 | 218 | 28 s |
| di | 33 | 384 | 24 s |
| redis | 25 | 164 | 18 s |
| eslint-plugin | 51 | 1,752 | 17 s |
| the 19 others | 245 | 3,357 | 87 s |

The five longest files are not long by their number of tests: their `beforeAll` compiles a
fixture project with both compilers under every decorator setting, one mode after another in the
same file (`packages/kernel/test/support/decorator-modes.ts`: two compilers, five settings,
eleven modes with the one the runner transforms itself).

| File | Wall | What it does |
|---|---|---|
| `kernel/test/declarations.spec.ts` | **84 s** | eleven compilations of the clinic, in a row |
| `cli/test/e2e/zero-violation.spec.ts` | 44 s | every stack generated and checked |
| `aspects/test/decorators.spec.ts` | 27 s | eleven compilations, in a row |
| `cli/test/e2e/formatted.spec.ts` | 27 s | |
| `http/test/controllers.spec.ts` | 25 s | five compilations, in a row |
| `di/test/discovered-context.spec.ts` | 22 s | eleven compilations, in a row |

A file is the unit of parallelism of the runner: no number of cores, workers or shards makes a
run shorter than its longest file. The 84 s file is the floor of every unit run on every
machine, and the reason the suite uses 5 files at a time at the end of a run.

The 84 s are not the cost of the matrix itself: the kernel package alone, its eleven
compilations included, runs in 13 s (`vitest run packages/kernel`). In the full run each
compilation, which takes every core the native compiler finds, competes with 20 workers and
with the compilers the other files spawn, and lasts six times longer. The suite oversubscribes
the machine: 20 workers that each start processes of 8 threads. That is why half the workers
cost only 14 percent of wall time (section 4) and why the compile matrix, run in parallel
inside its file or split per file, is the lever on the length of the run.

## Experiments on the test runner

Every run below is `vitest run` on the whole suite, on the workstation of the method, with the
default pool (`forks`) and isolation unless said otherwise.

| Setting | Wall | Peak memory | Files failed | Reading |
|---|---|---|---|---|
| default: `forks`, isolated, one worker per core | 104 s, then 88 s | 9.3 GB, then 11.3 GB | 0 | the reference, run twice (the second on a quieter machine) |
| `--maxWorkers=50%` | 101 s | **6.8 GB** | 0 | half the cores: 40 percent less memory for 14 percent more time (1) |
| `--maxWorkers=4` (a free runner) | 203 s | 4.4 GB | 0 | what a 4 vCPU runner does, with the child compilers on the other cores here |
| `--maxWorkers=4 --coverage` | 216 s | 4.2 GB | 0 | coverage costs 6 percent at four workers, 46 percent at twenty |
| `--pool=threads` | 480 s | 10.8 GB | 22 | the specs on PGlite, knex and prisma time out in their hooks: threads are out for this suite |
| `--pool=threads --coverage` | 471 s | 11.2 GB | 17 | same |
| `--no-isolate` | 68 s | **17.7 GB** | 2 | workers keep every module they loaded: 23 percent less time, 60 percent more memory, and two tracing specs read the spans of another (1) |
| `--no-isolate --sequence.shuffle`, twice | 84 s, 78 s | 20.3 GB, 19.6 GB | **44, then 30** | the order of the files decides which specs pass: the suite is not ready to share workers |
| `vitest related packages/kernel/src/domain/aggregate-root.ts` | 13 s | 2.1 GB | 0 | 58 of 745 files: the importers of the aggregate root |
| `vitest related packages/pino/src/index.ts` | 2 s | 0.5 GB | 0 | 3 of 745 files |
| `vitest run --changed 660215aa` | 85 s | 10.4 GB | 0 | everything: the range touched the lockfile, which reruns all by design |
| `vitest run packages/kernel` | 13 s | 2.2 GB | 0 | one package alone, its compile matrix included |
| `vitest run packages/pino` | 2 s | 0.6 GB | 0 | |
| `vitest doctor packages/kernel` | 142 s | 3.0 GB | | the runner's own comparison on one package: threads 3 percent, `isolate: false` 8 percent, 9 workers 7 percent faster; it recommends 9 workers |

(1) The first measure of these two settings was taken while another session loaded the machine
(load average 32 to 49 on 20 cores) and failed 9 and 1 files on timeouts; the table shows the
second measure, taken on a quiet machine.

What the table says:

- **Isolation is not the lever here.** The two documented levers of the runner, `isolate: false`
  and the `threads` pool, do not fit this suite: the specs start PGlite databases, child
  compilers and in-process servers, which threads cannot host, and which keep their memory once
  a worker is reused (17 to 20 GB without isolation). Without isolation 30 to 44 files fail
  depending on the order of the run: the suite relies on fresh modules, as most suites of
  this kind do, and making it order-independent would cost more than the 23 percent it would
  give. The 9 to 11 GB are 20 workers at about 450 MB each, plus the child processes; the
  lever on a laptop is the number of workers, which the generated projects already cap at
  half the cores outside a pipeline, and which this repository does not.
- **Selection below the package works and is cheap.** `vitest related` on one source file runs
  the files that import it, through the static import graph, in 2 to 13 s instead of 104 s.
  `--changed` runs everything as soon as the range touches the lockfile, the config or a setup
  file, which is the documented behaviour and the right one.
- **Coverage is cheap at four workers and expensive at twenty**: its cost is in the main
  process that remaps the reports, which is the bottleneck when 20 workers feed it.

## Experiments on the lint, the type check, the build and the install

Same workstation, same method; the findings column says whether a run reported the same things
as the reference run of ESLint (one warning on this tree).

| Step | Setting | Wall | Peak memory | Findings and reading |
|---|---|---|---|---|
| ESLint | as the pipeline runs it (`eslint .`) | 34.9 s | 3.0 GB | 1 warning; 58 to 87 s on a 4 vCPU runner |
| ESLint | sources only, `TIMING=1` | 28.7 s | 2.8 GB | no rule dominates: `no-unsafe-argument` 2.8 percent, `no-unnecessary-condition` 2.2, `unbound-method` 1.8; the cost is the type program itself |
| ESLint | `--cache --cache-strategy content`, first run | 34.9 s | 3.0 GB | same finding; the cache costs nothing to write |
| ESLint | the same, second run, nothing changed | **2.1 s** | 0.4 GB | same finding: a 17x shorter lint when the tree did not change |
| ESLint | `--concurrency=auto` | 21.7 s | **15.8 GB** | same finding; every thread builds its own type program: five times the memory for a third less time |
| Oxlint 1.89 | the 146 rules the migrator kept, no types (twice) | **2.0 s** | 0.3 GB | 16 findings ESLint does not report: 14 `no-redeclare` on the interface and class pairs of the declarations (TypeScript merges them; typescript-eslint leaves that rule to the compiler), 2 `no-unsafe-optional-chaining` |
| Oxlint | `--type-aware` (tsgolint 7.0) (twice) | **4.1 s** | 1.1 to 1.3 GB | the 16 above plus one `unbound-method` ESLint does not report: to examine |
| Oxlint | `--type-aware --type-check` | 6.2 s | 1.7 GB | 5 type errors `tsc` does not report, all in `test/`: the files were checked against the `tsconfig.json` of their package (sources only), not against their `tsconfig.test.json` |
| Oxlint | the 70 rules of the kit as a JS plugin, no types (twice) | 4.1 s | 0.4 GB | **the plugin fails on 2,494 files** ("Error running JS plugin: cannot convert undefined or null to object") and reports 43 `clean-stepdown` findings ESLint does not: the API of the alpha does not carry what the rules read |
| Oxlint | the same with `--type-aware` (twice) | 6.1 s | 1.3 to 1.5 GB | same |
| type check of the specs | 25 `tsc -p` in a row | 5.1 s | 0.4 GB | the typecheck job of the pipeline (39 to 44 s) is its setup and the build, not the check |
| type check of the specs | the 25 at once | 2.3 s | 2.4 GB | six times the memory for half the time: cap at the cores of the runner |
| `check --self` | 665 rule fixtures | 2.0 s | 0.1 GB | the architecture job (138 to 170 s) is its other steps: the release script, dependency-cruiser and nine `node --test` files |
| `tsc -b` from scratch | `--builders 1 --checkers 1` | 4.1 s | 0.7 GB | what one core would take: still under the restore of a cache |
| `tsc -b` from scratch | `--builders 2 --checkers 2` | 3.1 s | 0.6 GB | a 4 vCPU runner |
| `tsc -b` from scratch | default parallelism, 20 cores | 2.0 s | 0.6 GB | |
| install | `npm ci`, no `node_modules`, cache of npm warm (three runs) | 8.2 to 9.2 s | 1.8 GB | `npm ci` always writes the whole tree, 1,345 packages |
| install | `pnpm install`, no lockfile yet, default store | 106 s | 0.8 GB | the resolution, then the supply-chain check of pnpm 12 on the 1,557 entries of the new lockfile |
| install | `pnpm install --frozen-lockfile`, store warm, check not yet cached | 51 s | 1.0 GB | 50.3 s of "lockfile passes supply-chain policies", 0.5 s of linking |
| install | the same, store empty | 211 s | 0.5 GB | the download of the 1,361 packages |
| install | the same, store warm, check cached | **0.6 to 2.0 s** | 0.06 GB | hard links from the store: 1,361 packages in under a second |
| install | the same with `minimumReleaseAge: 0` | 0.6 s | 0.2 GB | the check skipped |
| install | nothing to do (`node_modules` present) | pnpm 0.05 s, npm 8.2 s | | npm reinstalls, pnpm answers |

Oxlint reads the whole tree in 2 s and its typed rules in 4 s, against 35 s for ESLint: the
speed reported by the other teams holds here. The findings do not: with the rules of
typescript-eslint and of ESLint alone, 16 to 17 findings appear that ESLint does not report,
one rule to turn off (`no-redeclare`) and three to examine; with the rules of the kit loaded
through the JS plugin API, which is alpha, the plugin breaks on 2,494 of the files and the
stepdown rule reports 43 findings ESLint does not. The findings parity is not there, and until
the plugin runs whole under that API, Oxlint cannot be the gate of a project that uses the
kit. It can run beside ESLint, not blocking, to measure the gap as the API matures.

## What other teams found

Three research notes, written on 2026-10-23 from public sources only, are summarized here; the
sources are at the end of the page. What they teach, applied to this repository:

### Compilers

TypeScript 7 (native, July 2026) is 8 to 12x faster than TypeScript 6 on full builds in the
tables of Microsoft, 3x in the first-hand reports of Prisma (74 s to 24 s on dozens of packages)
and of a 728-file application (6.7 s to 2.1 s), 7x for VS Code (36 s to 5 s). Memory fell much
less than time (6 to 26 percent). At 1.8 s and 0.86 GB this repository is already at the figures
of the smallest projects of those tables; 7.1 (beta of October 2026) announces another 1.2 to
1.9x and 16 to 50 percent less memory. `--builders` and `--checkers` set the parallelism and
multiply the memory. `tsc -b` with project references no longer buys speed at this size; it
stays for the `.d.ts` of each package, which the type-aware linters read. The one open gap that
matters: typescript-eslint cannot use the native compiler before its API ships in 7.1, and the
experimental bridge is 1.5x slower than TypeScript 6, not faster.

### Linters

typescript-eslint says itself that a typed lint runs about as slowly as the type check of the
same project under the compiler it uses, which is TypeScript 6. The levers reported without
changing tools: `--cache --cache-strategy content` with the cache kept as an artifact of the
pipeline (54 s to 2.4 s warm on 4 vCPU, same 344 findings, one team), `TIMING=1` to price the
rules, every file matched by the tsconfig of its package (a file matched by none costs 5 to
15 s), and `--concurrency=off` on 4 vCPU runners, where threads were slower in both measured
reports (single thread 54 s and 6.2 GB; 8 workers 31 s and 32.6 GB). A cache or a lint of the
changed files alone misses the effect of a change on the types of other files: one full typed
lint per merge stays.

Oxlint with tsgolint (type-aware, stable since July 2026, 59 of the 61 type-aware rules of
typescript-eslint) is the only path reported to a type-aware lint of a few seconds: 12 to 18x in
the tables of its authors, 20.5 s to 1.3 s with every finding plus 13 more in one independent run
of 403 files, 2 min 27 s to 1.3 s on an Nx monorepo of 206k lines, but only 2x for ManoMano
(500k lines). Its preconditions are met here (TypeScript 7, no `baseUrl`, `.d.ts` built). Its
costs: custom rules go through JS plugins, which are alpha and cost real time (one plugin took a
run from 2.5 s to 38 s), two type-aware rules missing, a few rule messages lost, an autofix that
once removed assertions the compiler needed. The 70 rules of the kit are the risk to measure, not
to assume: hence the experiment of section 5.

Biome 2.5 stays the formatter: its type inference found 1 of 2 floating promises and 0 of 6
misused promises in the one independent test, and its authors say they do not implement a type
system.

### Test runners

The documented levers of Vitest 5 are isolation off (a React suite of 10k tests, 12 min to
2 min, after fixing about 100 order-dependent tests), the `threads` pool, the number of workers
(above the vCPUs a CPU-bound suite slows down: 823 s at 4 workers, 925 s at 5, on a 4 vCPU
machine), sharding across machines with the coverage thresholds held on the merged report
(430 files, 887 s to 4 min 25 s with 6 shards, one team), `--changed` and `related` for
selection, and `experimental.recordDependencies` (5.0.4) which records what each test really
loaded, with documented holes (fixtures read with `fs`, `vi.mock` factories, dynamic imports
never called). A file is an atomic input of a shard: NVIDIA split spec files of 63 to 84 s for
that reason. node:test runs one process per file and was "significantly slower" for Astro; bun
test cannot run the v8 coverage provider; neither has a published comparison at 500 files.

### Orchestrators

Every large published gain of Nx or Turborepo (Hetzner 45 min to 6 min, a retailer 60 min to
8 min, Porsche Digital 12 min to 4.2 min) combines a remote cache of slow builds, distribution
over many agents, and a re-cut of the project boundaries; the one independent table, Sentry's,
moved the median run by 10 percent (20 min to 18 min) because tests, not builds, dominated.
Teams that left or never adopted an orchestrator (Trilium Notes, eslint-react, XWiki) cite the
daemon, the cache resets, the deprecations and the fear of a paid cloud. The self-hosted cache
packages of Nx were deprecated on 2026-05-21 after the CREEP vulnerability (CVE-2025-36852, a
pull request can seed the cache the trunk reads); the remaining remote caches are a paid or
quota-limited cloud, a server to operate, or the cache of GitHub Actions, whose scoping already
keeps a pull request from writing what the trunk reads. The supply-chain incident of August 2025
("s1ngularity", malicious releases of nx) adds a reason to keep the number of build tools small.
Nx 24 (October 2026) selects affected tasks by declared inputs, which is finer than the
per-package selection of this repository, at the price of declaring and maintaining those
inputs.

### Package managers

pnpm's own benchmark gives the install of a pipeline with a lockfile at 3.4 s against 13.9 s
for npm on a small graph, 9.2 s against 37.7 s on a 1 GB graph; it offers
`--filter "...[origin/main]"` (the changed packages and their dependents) and catalogs. Its
costs are the strictness of its symlinked layout (duplicates of peer dependencies, hoisting
patterns, `preserveSymlinks` forbidden). No first-party benchmark exists for Yarn 4; Bun's
"25x" has no stated setup.

### GitHub Actions

Public repositories get free standard runners of 4 vCPU and 16 GB, on x64 (two cores with
hyper-threading) and on arm64 (`ubuntu-26.04-arm`, four physical cores, generally available
since 2026-09-17); the two benchmarks found disagree (x64 wins single thread, arm64 wins all
cores), so a Node workload has to be measured. The Free plan runs 20 jobs at a time and queues
the rest; larger runners are paid and need a Team plan. The cache holds 10 GB per repository,
evicted hourly by least recent use; its key should hash the lockfile, the OS, the architecture
and the Node line, not the commit. A path filter cannot skip a required check, so the pattern is
a gate job that reads every other job (which this repository has). A merge queue is available to
organization-owned public repositories.

## Judgement: the options compared

| Option | Expected gain here | Cost or risk | Verdict |
|---|---|---|---|
| fewer jobs per run (merge the eight jobs under three minutes into two) | the queue: 24 jobs to about 17 per run, for the same work | none; a failure names its step | **do** |
| the heavy families narrowed on a pull request (one Node line, one package manager, the stacks a change reaches), everything on the trunk and at night | 10 to 14 min of runner time per family skipped, the queue freed for everyone | a regression caught at night or on the trunk instead of on the pull request: the pattern Sentry and netlify/cli use | **do** |
| the compile matrix of five spec files in parallel (one `Promise.all` of the modes) or one file per mode | the longest file from 84 s to about 15 s; the unit run no longer tails on one file | a few more spec files; the matrix stays whole | **do** |
| half the cores outside a pipeline in `vitest.config.ts`, as the generated projects do | 9.3 GB to about 6.8 GB on a laptop | the full run takes half as long again; `VITEST_MAX_WORKERS` overrides | **do** |
| `vitest related` and the affected selection before a push, instead of the full unit run with coverage | 152 s to 2 to 13 s for a change of one package | what the selection misses runs on the trunk; a change of the lockfile or a config reruns everything | **do** |
| ESLint `--cache --cache-strategy content`, the cache an artifact of the pipeline | measured in section 5 | a change of types in another file is seen by the full run of the trunk only | **do** |
| the type check of the specs in parallel | measured in section 5 | memory, 25 compilers at once: cap at the cores of the runner | **do** |
| the key of the install cache on the lockfile, the OS, the architecture and the Node line | fewer 330 MB copies, fewer misses | none | **do** |
| the heavy families run two files at a time, their one-file giants split (first written as two shards of the unit job) | the longest jobs of the trunk shortened without a job added | two generated projects share a runner: installs overlap specs, memory doubles, ports must not meet | **do, after the second line** |
| Oxlint with tsgolint, the kit rules as a JS plugin, beside ESLint and not blocking | a type-aware lint of 4 s instead of 35 s (section 5) | the kit plugin breaks on 2,494 files under the alpha plugin API and one native rule disagrees with TypeScript; two typed rules missing; findings to compare until the API carries what the rules read | **try, not as the gate** |
| arm64 runners for the unit and end-to-end jobs | four physical cores instead of two | unknown until measured: ten runs on each, p50 compared | **try** |
| pnpm for this repository | an install of 1 s instead of 8 s when its store is warm (section 5), and nothing to do when nothing changed | a migration of the lockfile, the layout and every spec that reads `node_modules`; in the pipeline the store would be restored from the cache as `node_modules` is today, for a gain of a few seconds per job; its supply-chain check costs 50 s the first time a lockfile is seen | **not now** |
| Nx, Turborepo or moon | a finer affected selection, a cache of task outputs | nothing slow to cache (the build takes 1.8 s); the affected script exists; a remote cache is paid, quota-limited, or a server; two incidents in 2025 | **no** |
| Biome as the linter | a lint of 100 ms | the typed rules of `strictTypeChecked` are not covered | **no** |
| bun test or node:test | | native modules, PGlite, the v8 coverage provider; no published gain at this size | **no** |

## Recommendation: the plan, in order

Each line is one pull request, with the indicator it moves written in its description, measured
before and after on the same runs.

1. **The pipeline: fewer jobs, and the heavy families narrowed on a pull request.** Merge the
   jobs under three minutes (docs, dead code, typecheck, lint, packages, security, architecture,
   site) into two jobs. On a pull request, run the alias suite on one Node line, the generated
   projects on npm only, and the end-to-end shards on the stacks the change reaches (a template
   of `packages/<name>/templates/` reaches the stacks that use that package: the selection is
   the one of `affected-packages.mjs`, extended to the `STACKS` table of the suite). The trunk
   and the night keep the whole matrix, as today. Indicators: queue time p50 and p95 per job, wall
   time of a pull request run, jobs per run.
2. **The compile matrix in parallel.** `decoratorModes` compiles every mode at once when the
   first `load` is called, or the five spec files are split per compiler; the longest file
   falls under 20 s. Indicator: the longest file, and the wall time of the unit run on 20 cores
   and on 4 vCPU.
3. **A laptop takes half the cores, and pushes after `related` tests.** `maxWorkers: '50%'`
   outside a pipeline in the root `vitest.config.ts`, as the generated configs already do;
   the pre-push hook runs `affected-packages.mjs --base origin/main` and the unit specs of those
   packages without coverage, the full run with coverage left to the pipeline. Indicators: peak
   memory of the process tree, wall time before a push.
4. **The lint and the type check.** ESLint with `--cache --cache-strategy content`, the cache
   restored from the cache of the pipeline by a key of the lockfile and the ESLint config with
   a prefix fallback; `typecheck:tests` as one `tsc -b` solution or 25 projects at once capped
   at the cores. Indicators: wall time of the lint job and of the typecheck job, findings
   parity.
5. **The install cache.** Its key on the lockfile, the OS, the architecture and the Node line;
   the built packages kept as they are. Indicator: cache hit rate and the size of the cache.
6. **The heavy families run two files at a time, and their one-file giants are split.** Written
   first as two shards for the unit job, when that job took 9.5 min; after the second line it
   takes 6 to 8 min, and the longest jobs of the trunk are the generated projects on npm (13 min:
   four files one after the other), the end-to-end shards (11 to 13 min) and the alias runs
   (12 min: 35 stacks in one file). A second shard of the unit job would add a job to the queue
   and shorten nothing. Instead: the generated projects and the alias runs take two files at a
   time (`VITEST_MAX_WORKERS=2` for the run and for the specs of each generated project, which
   then share the four cores two by two; a project installs from npm while another runs its
   specs), `alias-runtime.spec.ts` split in two files of half the stacks each, and any free port
   for an application the specs start, so that two never meet on one. The end-to-end shards stay
   one file at a time: their files run the specs of generated projects under coverage, which
   time out at five seconds when two projects share four cores (seen on one shard); they are
   balanced on the seconds the runners measured instead (505 to 521 s per shard against 352 to
   715 s). Indicator unchanged: wall time of the longest job of the trunk, measured on a machine
   held to four cores (section 5) and on the runs of the pipeline.
7. **Two trials, non-blocking and measured for a month**: Oxlint with tsgolint and the kit
   rules as a JS plugin, its findings compared with ESLint's on every run, starting with the
   reason the plugin breaks under that API (a rule that reads something the alpha does not
   carry), reported upstream or worked around in the plugin; the unit and end-to-end jobs on
   `ubuntu-26.04-arm` on the night runs, their p50 compared with the x64 runs. Each ends with a
   verdict written on this page. The Oxlint trial continues as the plan of
   [The tools of the oxc-project](#the-tools-of-the-oxc-project-measured-on-2026-10-26) says: the
   plugin fixed first, then the findings compared, then the gate.

What this plan does not do: it adds no tool a contributor has to learn, no daemon, no remote
cache with a credential, and it keeps the full matrix on the trunk and at night, which is what
makes the selection safe.

## What a generated project gets

The projects `ddd-ts-kit init` writes already hold the levers of this page that matter to a
team: half the cores outside a pipeline, `ddd-ts-kit affected` on the contexts a branch reaches
before a push and on a pull request, the lint of the staged files on commit, one gate job that
reads every other job. What this study adds to their templates, in the same order: the ESLint
content cache in the pipeline template, and the indicators of this page in the pipeline
README, so that a team measures before it changes a tool. An orchestrator is not added to the
templates for the reasons above.

## The tools of the oxc-project, measured on 2026-10-26

The oxc-project (VoidZero) ships a family of Rust tools for JavaScript and TypeScript: Oxlint and
its type-aware engine tsgolint, the formatter Oxfmt, the transformer `oxc-transform` with its
isolated declarations, and, on Rolldown, the library bundler tsdown; Vite 8, under Vitest 5,
already transforms with Oxc. This section measures each one against the tool it would replace in
this repository and in the projects `init` writes, on the indicators of the method: findings
parity first (a faster tool that does not do the same job is not a candidate), then wall time,
CPU time and peak memory. Nothing is adopted here: the plan at the end lists the pull requests
that would.

### Where the pipeline spends its time

Medians of 17 runs from 2026-10-24 to 2026-10-26 (seven of the trunk, eight pull requests, two
nights), per job, in seconds of a runner, read from the API of GitHub Actions:

| Job | Trunk | Pull request | Night |
|---|---|---|---|
| End-to-end tests, the four shards together | 3,494 | 3,450 | 2,953 |
| Generated project on npm, on pnpm | 840, 568 | 865, not run | 824, 597 |
| Unit tests, Node 24 with coverage, Node 22 | 651, 627 | 450, 330 | 612, 473 |
| Import alias at run time, Node 22, Node 24 | 445, 385 | not run, 533 | 464, 490 |
| Example application | 400 | 397 | 358 |
| Integration, architecture, every rule broken once | 204, 189, 171 | 29, 183, 175 | 196, 166, 139 |
| Static checks (type check 24 s, pack 51 s, site 31 s) | 137 | 138 | 141 |
| **Lint** (ESLint 70 s on the trunk, which writes its cache; format check 2 s) | **97** | **38** | **77** |
| Trial, Oxlint beside ESLint (Oxlint itself 13 s) | 38 | not run | 33 |
| Install and build (the build restored from its cache) | 33 | 33 | 23 |
| **A whole run** | **about 8,300** | **about 7,700** | **7,500 to 11,800** |

The lint and the format check of this repository are 1.2 percent of a trunk run and 0.5 percent
of a pull request run, and the build runs once per state of the sources, every other job
restoring it. About 6,300 of the 8,300 seconds of a trunk run go to the families that generate
projects and run their gate (install, compiler, ESLint, Biome, specs with coverage, checker,
graph, dead code). A faster tool shortens the pipeline where it runs inside those projects,
which is part 5, more than in the jobs of the repository itself; on a workstation it shortens
what a person or an agent waits for.

### Method of the day

The workstation of the study (20 cores, 32 GB, Linux 6.8), Node 24.22.1, npm 11.19.1. Versions:
ESLint 10 and typescript-eslint 8 as locked, Oxlint 1.89.0 with oxlint-tsgolint 7.0.2005
(TypeScript 7.0.2 inside), @oxlint/migrate 1.89.0, Biome 2.6.2, Oxfmt 0.74.0, native TypeScript
7.0.2, TypeScript 6.0.3, oxc-transform 0.155.0, tsdown 0.23.2 on Rolldown 1.2.15, Vitest 5.0.5
on Vite 8.3.4 and Rolldown 1.2.13. Each command ran under `nice`, one at a time, three times, five
when the load average of the last minute was above 4 before it (the whole unit suite: three runs
whatever the load, its own workers raise it); the tables give the minimum and the median of the
wall time, the median of the CPU time (user and system, `/usr/bin/time`) and the median of the
peak memory of the whole process tree, the resident memory of every process under the command
summed every 200 ms from `/proc`. A command shorter than 200 ms escapes that sampling: its peak is
then the one `/usr/bin/time` gives for its main process alone (`%M`), the larger of the two being
kept. The machine was shared with other coding agent sessions (load 0.7 to 17 before a run, each
recorded); a figure measured under a load of its own is compared only with one measured under a
similar load. The tools the repository does not install ran from the cache of `npx -y
<package>@<exact version>`, which leaves the repository untouched. The raw runs are in
[build-and-test-velocity-oxc.csv](build-and-test-velocity-oxc.csv) (the exit code of a command
wrapped in `sh -c '...; true'` is the wrapper's).

### 1. Oxlint and tsgolint against ESLint and typescript-eslint

**What it replaces.** ESLint, typescript-eslint and the rules of the kit, loaded as a JS plugin:
`npm run lint`, the Lint job and the ESLint step of the pre-commit hook here; `ddd-ts-kit lint`
and its job in a generated project.

**Parity.** Four trees, the same rules on both sides.

| Tree | ESLint | Oxlint | Same file, line and rule | Oxlint only |
|---|---|---|---|---|
| this repository, the gate as configured (6,084 files) | 3 | 6 | 3 | 3 |
| the 1,326 spec files under the untyped rules of the sources, a corpus with findings | 1,197 | 1,199 | 1,197 | 2 |
| the copy of the example, untouched, the preset of the kit (985 files) | 0 | 345 | 0 | 345 |
| the same with every rule of the catalogue broken once, `naming-business-name` off in Oxlint | 89 | 97 | 86 | 11 |

- **This repository.** The kit plugin now runs whole under the JS plugin API (it broke on 2,494
  files on 2026-10-23, before #257). The three findings ESLint does not report are true:
  `no-unsafe-optional-chaining` twice on `(x?.y as T)['200']` in two specs, where Oxlint sees
  through the type assertion and the core rule of ESLint does not, and `unbound-method` once on
  `(this.options.follow ?? followWithFetch)(request)` in `packages/testing`, where `follow` is
  declared as a method: the call loses its `this`, and typescript-eslint misses it.
- **The corpus.** The untyped rules of the sources (the `clean-*` rules of the kit, the layout of
  `@stylistic`, `complexity`, `max-depth`, the strict set of typescript-eslint) applied to the
  specs, which are not held to them: 755 `clean-stepdown`, 225 `clean-no-escape-hatch`, 173
  `clean-function-size`, 22 `complexity`, 13 `consistent-type-imports` and 9 others, each at the
  same place in both tools, the same two `no-unsafe-optional-chaining` apart.
- **The example, where the parity breaks.** The conformance suite breaks every rule of the
  catalogue once in a copy of the example; the same copy, run through both tools in the same
  rounds, says what the corpus could not:
  - `naming-business-name` reads the types through `getParserServices`, which a JS plugin of
    Oxlint does not get: the rule throws, and the throw stops **every rule of the kit** on the
    file. On the untouched copy that is 303 files of 985 with no kit rule run at all, and 50 of
    the 77 injections ESLint reports missed.
  - `clean-no-commented-out-code` and `language-declared-vocabulary` parse text with
    `context.languageOptions.parser`, which Oxlint does not hand over: they report nothing,
    silently. `clean-no-commented-out-code` is on in this repository too; a probe file with
    `// const doubled = value * 2;` gets the finding from ESLint and none from Oxlint.
  - `consistent-type-imports` of Oxlint does not know `emitDecoratorMetadata`, which projects on
    `--dependencies signature` turn on: 41 findings on the untouched copy and 10 more in the
    rounds, all false (the constructor parameters are read at run time; its fix would break the
    wiring).
  - With `naming-business-name` off, 74 of the 77 injections ESLint reports are reported by both,
    86 of 89 findings at the same place; the misses are the three rules above.

**What differs in the configuration.** The parity holds once the configuration says the same
thing, which the migrator does not do alone:

- `@oxlint/migrate` cannot express a block whose `files` combine with the `files` of a config it
  extends (16 warnings "AND glob patterns" here): it drops four rules of the sources (`no-var`,
  `prefer-const`, `prefer-rest-params`, `prefer-spread`) and leaves on thirteen core rules that
  typescript-eslint turns off because the compiler checks them (`constructor-super`,
  `no-dupe-keys`, `no-unreachable` and ten others). The committed `.oxlintrc.json` has both gaps,
  and lacks the ignore of `packages/audit/test/generated/`. The preset of a generated project has
  no such nesting, and its rule sets match.
- Not implemented: `@typescript-eslint/no-unsafe-enum-assignment` (in `strictTypeChecked`).
  `no-octal` and `no-dupe-args` are syntax errors in a module and need no rule.
- In the nursery of Oxlint (off unless named): `no-unnecessary-condition` (typed, in
  `typedCleanCode` of the kit), `no-useless-assignment`, `no-undef`. Named, they report nothing on
  this repository, as ESLint; on a probe file `no-unnecessary-condition` found both of its faults
  and `no-useless-assignment` missed the one it should report.
- `no-undef` of Oxlint does not treat a `.cjs` file as CommonJS: on a generated project it
  reports `module` in `.dependency-cruiser.cjs`; an `env` of `commonjs` for `**/*.cjs` settles it.
- Oxlint has no cache, and needs none at these times.

**Cost on the workstation:**

| Run | Wall min / median | CPU | Peak memory |
|---|---|---|---|
| ESLint, whole repository, no cache (`eslint .`) | 35.7 / 36.4 s | 58.5 s | 3.0 GB |
| ESLint, content cache, nothing changed (`npm run lint`) | 1.16 / 1.17 s | 1.7 s | 0.39 GB |
| ESLint, content cache, one source file changed | 1.65 / 1.69 s | 2.8 s | 0.50 GB |
| Oxlint, whole repository, typed, kit rules as a JS plugin (`npm run lint:oxlint`) | 5.75 / 5.85 s | 20.2 s | 1.63 GB |
| Oxlint, typed, native rules only | 2.39 / 2.45 s | 14.7 s | 1.33 GB |
| Oxlint, untyped, with the JS plugin | 3.42 / 3.50 s | 6.2 s | 0.45 GB |
| Oxlint, untyped, native rules only | 0.07 / 0.08 s | 0.7 s | 0.29 GB |
| the 13 files of a typical commit (#405), ESLint as the pre-commit hook runs it (no cache) | 1.62 / 1.63 s | 3.5 s | 0.50 GB |
| the same, Oxlint typed with the JS plugin | 0.82 / 0.82 s | 2.8 s | 0.29 GB |
| the spec corpus, ESLint / Oxlint, untyped, kit plugin | 5.59 / 5.61 s, 1.67 / 1.69 s | 10.3 s, 3.5 s | 0.79 GB, 0.39 GB |

Read: without a cache Oxlint is six times faster than ESLint and takes half its memory; of its
5.9 s, 3.4 s are the kit plugin running in JavaScript and 2.4 s the typed rules, the native rules
alone taking 80 ms. With its content cache ESLint answers on a workstation in 1.2 to 1.7 s, faster
than Oxlint: the gain is on a cold run (a fresh worktree, a changed config or lockfile, the trunk
job that writes the cache: 70 s of ESLint against 13 s of Oxlint on the same runner) and in the
pre-commit hook (0.8 s per commit).

**Verdict for this repository: not yet; try in CI once the plugin runs whole.** On the rules
Oxlint holds natively the parity is reached (1,197 of 1,197 on the corpus, three true findings
more on the tree), which the study of 2026-10-23 could not say. The plugin of the kit is what
stops it: one rule that throws without types and two that report nothing without a parser, one of
them on in this repository. The gain, once that is fixed, is small for the pipeline (about 57 s
of a trunk run, 0.7 percent) and real on a cold workstation (36 s, 58 CPU s and 3.0 GB to 6 s,
20 CPU s and 1.6 GB).

### 2. Oxfmt against the formatter of Biome

**What it replaces.** `biome format`: the format check of the Lint job and of the pre-commit hook,
`npm run format`. The linter of Biome is off in this repository.

**Parity.** `oxfmt --migrate=biome` carries over width 120, single quotes, trailing commas,
semicolons and parentheses around arrow parameters. On the 7,171 files Biome formats (6,985
`.ts`), Oxfmt would rewrite 73: 30 `package.json` whose fields it sorts by default
(`sortPackageJson`, which can be turned off), and 43 TypeScript files on 314 lines where Oxfmt
prints as Prettier does and Biome does not: a class header with a long `implements` (11 places),
a last argument that is an arrow with a return type, hugged (12), a long export list put back on
one line, a member chain broken, the `; )` of an empty `for` clause. Nothing that changes the code:
a one-time reformat of 43 files, then a style that follows Prettier instead of Biome. Out of the
box it also formats Markdown, YAML and the other files Biome leaves alone (18 files of a
generated project, its README among them).

| Run | Wall min / median | CPU | Peak memory |
|---|---|---|---|
| Biome 2.6.2, format check of the repository | 0.33 / 0.33 s | 5.1 s | 0.24 GB |
| Oxfmt 0.74.0, the same 7,171 files | 0.13 / 0.13 s | 1.1 s | 0.21 GB |
| Biome / Oxfmt, a generated project (`init`, 82 `.ts`) | 0.04 / 0.05 s, 0.03 / 0.04 s | 0.1 s, 0.1 s | 0.05 GB, 0.18 GB |

**Verdict: not now.** Oxfmt is 2.5 times faster and spends a fifth of the CPU on a step of a third
of a second, 2 s of a pipeline job: nothing to win, a reformat to pay, a beta (0.x since February
2026) instead of a 2.x. To look at again if the format check becomes a slow step, or once Oxlint is
the linter and one toolchain means one tool less.

### 3. The build: tsdown and oxc-transform against the native compiler

**What it would replace.** `tsc -b` of the 26 packages, which type-checks and writes JavaScript,
declarations and maps, and `pipeline/monorepo/add-extensions.mjs`, which writes the `.js` the
sources leave out.

| Run | Wall min / median | CPU | Peak memory | What it does not do |
|---|---|---|---|---|
| `npm run build` from scratch, 26 packages | 1.99 / 2.01 s | 14.1 s | 0.93 GB | |
| `npm run build`, nothing to do | 0.24 / 0.25 s | 0.4 s | 0.13 GB | |
| `add-extensions` alone | 0.08 / 0.08 s | 0.1 s | 0.06 GB | |
| `tsc -b packages/kernel` from scratch, 644 files | 0.19 / 0.19 s | 1.0 s | 0.17 GB | |
| tsdown, the kernel unbundled, declarations through TypeScript 6 | 2.07 / 2.09 s | 4.4 s | 0.75 GB | type check; writes `.mjs` and `.d.mts` |
| tsdown, the kernel unbundled, no declarations | 0.21 / 0.22 s | 0.9 s | 0.28 GB | declarations, type check |
| oxc-transform, the 4,582 sources, JavaScript and isolated declarations | 0.41 / 0.41 s | 0.5 s | 0.08 GB | type check, `.js` in imports; 305 declaration errors |
| oxc-transform, JavaScript only | 0.28 / 0.28 s | 0.3 s | 0.08 GB | declarations, type check, `.js` in imports |

Read: the native compiler builds the kernel in 0.19 s with its type check; tsdown is not faster
without declarations and is eleven times slower with them, since its declaration plugin calls the
JavaScript API of TypeScript 6 (TypeScript 7 has none yet). oxc-transform writes the whole tree in
0.4 s on one core, but its declarations need `isolatedDeclarations`, which 183 source files break
298 times (`tsc --isolatedDeclarations`: explicit return and property types missing, TS9010 115
times, TS9013 113), it type-checks nothing, so a `tsc --noEmit` stays beside it, and it leaves the
extensionless imports as they are.

**Verdict: not now, nothing to win.** The build costs 2 s from scratch and a quarter of a second
when nothing changed; a change of tool would trade the declarations or the type check for at most
a second and a half, once per state of the sources in the pipeline. To look at again if a package
must ship a bundle, or when TypeScript 7.1 gives tsdown a native declaration path.

### 4. Vitest on Vite 8: what the Oxc transform already gives

The Vitest configs of the repository and of the generated projects set no transform: Vitest 5.0.5
runs on Vite 8.3.4, which transforms with Oxc and bundles with Rolldown; there is no esbuild or SWC
left to replace. Tried beside the pools and the isolation the study already ruled out:

| Setting | Wall min / median | CPU | Peak memory |
|---|---|---|---|
| `vitest run packages/kernel` (59 files, half the cores), the module cache of Vitest warm (`experimental.fsModuleCache`, on by default) | 7.38 / 7.40 s | 79.1 s | 4.3 GB |
| the same, that cache emptied before each run | 11.78 / 11.93 s | 84.5 s | 4.4 GB |
| the same, that cache turned off | 11.54 / 11.74 s | 84.8 s | 4.3 GB |
| the same, four workers, warm / cold, under the same load | 7.14 / 7.18 s, 11.77 / 11.82 s | 67.3 s, 73.9 s | 4.1 GB, 3.9 GB |
| `deps.optimizer.ssr.enabled`, cache warm | 7.31 / 7.42 s | 79.0 s | 4.3 GB |
| `vitest run packages/http` (47 files), warm / cold | 4.00 / 4.05 s, 5.10 / 5.42 s | 48.8 s, 56.4 s | 1.9 GB, 2.1 GB |
| the whole unit suite (844 files), warm / cold | 118.5 / 122.2 s, 123.4 / 129.5 s | 1,610 s, 1,620 s | 6.7 GB, 7.4 GB |
| `experimental.viteModuleRunner: false` (the loader of Node) | fails | | |

Read: the transform of Oxc runs in the main process, which feeds every worker, so on a small
package the module cache of Vitest 5 saves 38 percent of the wall time (the kernel, warm and cold
under the same load; 25 percent on http, cold under a heavier one); on the whole suite,
where the specs themselves dominate (child compilers, PGlite), it saves 5 percent of the wall
time and 1 percent of the CPU, for a cache of 122 MB. The dependency optimizer adds nothing. The
loader of Node cannot resolve the extensionless imports of the sources. On a workstation the
cache is already on; in the pipeline it is always cold, since it lives in `node_modules`, which the
install job saves before any spec ran.

**Verdict: nothing to change.** Keeping that cache in the pipeline would win about 5 percent of a
unit job (some 30 s of 650) for 122 MB more in a cache of 10 GB already half full: not now.

### 5. What a generated project gets

`init` writes ESLint with the preset of the kit, Biome as the formatter, the native compiler and
Vitest. Measured: a project of `init --context billing:core --package-manager npm`, installed from
the registry (kit 0.92.0, 82 TypeScript files), and the example application (985 files) as a
grown one.

| Step | `init` project | the example |
|---|---|---|
| the whole gate (`npm run verify`, the lint from its cache) | 7.41 / 7.71 s, 14.0 s CPU, 1.3 GB | |
| ESLint, no cache (the job of a fresh clone, and every gate of the families of this pipeline) | 2.89 / 3.05 s, 5.9 s CPU, 0.66 GB | 10.25 / 11.18 s, 19.1 s CPU, 1.2 GB |
| `ddd-ts-kit lint`, cache warm | 1.07 / 1.10 s, 1.6 s CPU, 0.43 GB | |
| Oxlint, typed, the preset as migrated | 1.00 / 1.01 s, 3.2 s CPU, 0.38 GB | 2.42 / 2.62 s, 7.3 s CPU, 0.87 GB (`naming-business-name` off) |
| Oxlint, typed, native rules only | | 0.58 / 0.59 s, 3.7 s CPU, 0.72 GB |
| type check | 0.23 s, 1.2 s CPU | 0.44 / 0.45 s, 3.0 s CPU, 0.49 GB |
| Biome, format check | 0.05 s | 0.10 s |
| specs with coverage | 2.51 / 2.79 s, 5.5 s CPU, 1.3 GB | |

Read: a cold ESLint is a third of the gate of a new project and the largest static step of a grown
one, 25 times the type check; Oxlint would take it from 3 s to 1 s and from 11 s to 2.6 s, with
40 to 55 percent of the CPU and 60 to 70 percent of the memory. In this pipeline the end-to-end
families run the gate of about 35 sample projects, each cold, so the saving would be of the order
of one to five minutes of runners per run, at most 3 percent; in the pipeline of a user's project,
whose lint job reads the ESLint cache of its trunk, it is the cold runs only.

**Verdict: not now.** The parity is not there on the preset (part 1): one rule of the kit that
stops all the others on 303 files of 985, two that report nothing, a native rule that reports 41
false findings on the projects that wire by constructor signature and whose fix would break them.
The CLI, the guard and `ddd-ts-kit lint` run ESLint, and the plugin is an ESLint plugin; a second
linter in the templates is a choice for a project to opt into, after the fixes below, not a default.

### Verdicts, and the plan of the follow-up pull requests

| Tool | Replaces | Deciding figure | Verdict |
|---|---|---|---|
| Oxlint + tsgolint, kit rules as a JS plugin, in this repository | ESLint + typescript-eslint | native parity 1,197 of 1,197; but `clean-no-commented-out-code` reports nothing under Oxlint; 36 s to 6 s cold, ESLint already at 1.2 s with its cache | **not yet: try in CI after the plugin fix** |
| the same in the projects `init` writes | the same | 74 of 77 injections, one rule stopping the plugin on 303 of 985 files, 41 false `consistent-type-imports` | **not now; an opt-in after the fixes** |
| Oxfmt | the formatter of Biome | 0.33 s to 0.13 s on a step of 2 s in the pipeline; 43 files reformatted | **not now** |
| tsdown, oxc-transform | `tsc -b` and `add-extensions` | build 2.0 s; tsdown eleven times slower with declarations; 298 isolated-declaration errors | **not now** |
| the module cache of Vitest kept in the pipeline | nothing (a setting) | 5 percent of the whole suite for 122 MB | **not now** |
| the dependency optimizer, the loader of Node in Vitest | | no gain; fails on extensionless imports | **no** |

The plan, in order; each line is one pull request, measured before and after on the indicators
of this page:

1. **The plugin of the kit runs whole under Oxlint.** `clean-no-commented-out-code` and
   `language-declared-vocabulary` parse with a parser of their own when
   `context.languageOptions.parser` is absent; `naming-business-name` falls back to the names of
   the code when the parser services are absent, instead of throwing. A spec runs the rules of
   the plugin on the same samples under both linters. Gain: none by itself; the condition of the
   rest (77 of 77 injections expected).
2. **The trial job compares, and the Oxlint config says what the ESLint config says.** The four
   dropped rules back, the thirteen extra ones off, the nursery rules named, `commonjs` for
   `.cjs`, the missing ignore; the nightly job diffs the findings of both tools (file, line, rule)
   on this repository and on the broken copy of the example, and writes the difference to its
   summary, still failing nothing. Gain: none; it makes the verdict a figure.
3. **Oxlint as the lint gate of this repository**, after a month of nights without a difference:
   `npm run lint`, the Lint job and the pre-commit hook on Oxlint, ESLint kept at night for
   `no-unsafe-enum-assignment` and as the reference of the plugin. Expected: the Lint job of the
   trunk from 97 s to about 40 s (one CPU minute per trunk run), a cold lint on a workstation from
   36 s, 58 CPU s and 3.0 GB to 6 s, 20 CPU s and 1.6 GB, the hook from 1.6 s to 0.8 s per commit.
4. **Oxlint as an opt-in of `init`**, if the maintainer wants a second linter in the templates:
   the preset written for Oxlint as well, `consistent-type-imports` off where the project wires by
   constructor signature, a pair of the support matrix for it. Expected: the cold lint of a
   project from 3 s to 1 s, of a grown one from 11 s to 2.6 s (19 to 7 CPU s, 1.2 to 0.9 GB).
5. Oxfmt, tsdown, oxc-transform and the module cache of Vitest in the pipeline stay out; this
   section is the figure to compare with when one of them changes.

### Results of the plan: items 1 and 2 (branch `fix/oxlint-plugin-whole`)

**Item 1, the plugin runs whole.** Three changes in `packages/eslint-plugin`: `naming-business-name`
asks for the parser services in a `try` and reads the names of the code when the linter offers none;
four rules that parse a text of their own (`clean-no-commented-out-code`, `language-declared-vocabulary`,
`authz-declared`, `ports-implements-never-extends`) take the parser of typescript-eslint when the run
configured none. The parser Oxlint hands its JS plugins as `languageOptions.parser` is a stand-in
named `oxlint` whose `parse` throws "not implemented yet": it is treated as no parser at all, which
is why the first attempt (take `languageOptions.parser` when present) still missed two rules. A spec
of the package runs three rules on one file under ESLint and under Oxlint and compares them. The
measure is the one of the study, the harness of the conformance suite (every injection in rounds on
a copy of the example, both tools, same files):

| Copy of the example, 115 files in 7 rounds | Before | After |
|---|---|---|
| files on which no rule of the kit ran (`fatal`) | 303 of 985 | 0 |
| findings on the untouched copy | 345 (303 `fatal`, 41 `consistent-type-imports`, 1 `no-undef`) | 42 (41 `consistent-type-imports`, 1 `no-undef`) |
| injections ESLint reports that Oxlint reports too, `naming-business-name` on | 27 of 77 | **77 of 77** |
| the same, `naming-business-name` off | 74 of 77 | 77 of 77 (the rule is no longer needed off) |
| findings of the rounds, ESLint / Oxlint / at the same place | 89 / 108 / 29 | 89 / 100 / **89** |
| findings only Oxlint makes | 68 `fatal`, 11 `consistent-type-imports` | 11 `consistent-type-imports` |
| findings only ESLint makes | 60 | 0 |

What is left is outside the plugin: `consistent-type-imports` of Oxlint ignores
`emitDecoratorMetadata` (41 on the untouched copy, 11 in the rounds, all false) and `no-undef` reads a
`.cjs` as a module; both belong to item 4, the Oxlint preset of a generated project.

**Item 2, the configuration and the comparison.** `.oxlintrc.json` has the four rules back
(`no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread`, on sources and tests), the
fifteen core rules that typescript-eslint turns off for TypeScript (the study counted thirteen; read
from `eslint --print-config` of a source file, they are `constructor-super`, `getter-return`,
`no-class-assign`, `no-const-assign`, `no-dupe-class-members`, `no-dupe-keys`, `no-func-assign`,
`no-import-assign`, `no-new-native-nonconstructor`, `no-obj-calls`, `no-setter-return`,
`no-this-before-super`, `no-unreachable`, `no-unsafe-negation`, `no-with`) off, the ignore of
`packages/audit/test/generated/`, and `no-unused-vars` off on scripts as in ESLint. Oxlint then
reported three true findings ESLint does not make (two `no-unsafe-optional-chaining` on
`(x?.y as T)['200']` in specs of `packages/http`, one `unbound-method` on
`(this.options.follow ?? followWithFetch)(request)` in `packages/testing`); they are fixed in the
code, so that both tools say the same on this tree. The trial job runs both tools with their JSON
output and `pipeline/monorepo/compare-linters.mjs` writes to its summary the totals and every
finding only one side makes, by file, line and rule, `no-unsafe-enum-assignment` set apart as
expected. It stays outside the gate (`continue-on-error`, not needed by the gate job); the ESLint
run of the job is cold, which adds about 70 s to a job of 38 s that runs on the trunk and at night
only. The comparison on the broken copy of the example is not in CI: it needs the whole conformance
suite (a build of every package and a generated Oxlint configuration for the example, which the
migrator writes and the repository does not keep), about 40 s on a workstation; the measure above is
its record.

| This repository, 6,084 files | ESLint | Oxlint | At the same place | Only Oxlint |
|---|---|---|---|---|
| before (the gate as configured on 2026-10-26) | 3 | 6 | 3 | 3 |
| after | 3 | 3 | **3** | 0 |

### Results of the plan: item 3, the Lint job of a pull request on Oxlint

The condition (no difference with ESLint on this repository, file, line and rule) holds: 3 findings
on each side, 3 at the same place, `no-unsafe-enum-assignment` the only rule ESLint has and Oxlint
lacks, and it reports nothing here. The Lint job of a pull request now runs the format check and
`npm run lint:oxlint`; the trunk and the night run ESLint on the whole tree, as before, without the
cache (which only the pull requests read). `npm run lint` stays ESLint with its content cache.
Measured on the workstation of the study, `nice`, one command at a time, load average of the
last minute before each run:

| Run | Load | Wall min / median | CPU (median) | Peak memory (median) |
|---|---|---|---|---|
| `npm run lint`, ESLint content cache, nothing changed (3 runs) | 4.4, 3.4, 3.3 | 1.22 / 1.24 s | 1.75 s | 0.38 GB |
| `npm run lint:oxlint`, whole repository, typed, kit plugin (3 runs) | 3.0 to 3.2 | 5.86 / 5.93 s | 20.3 s | 1.55 GB |
| `eslint .`, no cache, what the trunk runs (3 runs) | 2.6 to 3.1 | 36.9 / 37.2 s | 59.5 s | 3.0 GB |

Read: against a pull request that finds its cache, Oxlint is not faster: 5.9 s against 1.2 to 1.7 s
of lint (the job lasts 38 s at the median, set-up included). What the change buys is that the
pull request no longer depends on the cache: a first pull request after a change of the config, of
the lockfile or of a rule of the kit (the cache is then dropped) lints the whole tree in 6 s of
Oxlint instead of 37 to 70 s of ESLint, and the job loses its two cache steps. The trunk job, which
writes the cache, is unchanged at about 97 s, hence no saving of the 57 s the plan expected there:
the trunk keeps ESLint as the reference. The final time of the Lint job of a pull request is
estimated at its current 38 s minus the cache restore, plus about 4 s: no measurable change when
the cache is found, 30 to 60 s less when it is not.

### Results of the plan: item 4 of the request, the pre-commit hook on Oxlint

The hook lints the staged files with `oxlint --type-aware --no-error-on-unmatched-pattern` instead of
ESLint (the flag is needed: Oxlint exits 1 when every file it is given is ignored, a commit of
templates only, and then lints the working directory, which costs a run and fails nothing). The 13
files of a typical commit (#405), five runs each because the load average was above 4:

| Run | Load | Wall min / median | CPU (median) | Peak memory (median) |
|---|---|---|---|---|
| ESLint, `--no-warn-ignored`, no cache (the hook as it was) | 4.6 to 4.8 | 1.66 / 1.70 s | 3.71 s | 0.48 GB |
| Oxlint, typed, kit plugin (the hook now) | 4.4 to 4.7 | 0.79 / 0.81 s | 2.80 s | 0.29 GB |

The hook is twice as fast, on the same files and the same parity as the Lint job.

## Still to verify

- The findings of Oxlint with the kit rules as a JS plugin against ESLint's, on this tree and
  on a generated project, over several weeks of changes: the trial job of #256 writes them to
  the summary of each run of the trunk and of the night. On 2026-10-26 the native rules were at
  parity and three rules of the kit were not (see the plan of the oxc-project section); the
  comparison is to be redone on the broken copy of the example once the plugin is fixed.
- The p50 of the unit and end-to-end jobs on arm64 runners against x64, over ten night runs.
- The recall of the end-to-end selection by stack: a template change that reaches a stack the
  selection did not name is a bug of the selection, caught by the night run and recorded here.
- The gain of `experimental.recordDependencies` on the `related` selection, once the specs that
  read fixtures with `fs` are listed.
- TypeScript 7.1: the memory of `tsc -b` and the API that lets typescript-eslint use the native
  compiler, which changes the arithmetic of the lint.

## Sources

Measures of this repository: the scripts of the method are not kept in the repository; the
figures are those of 2026-10-23, reproducible with `/usr/bin/time -v` and the API of GitHub
Actions (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`). Those of 2026-10-26 are in
[build-and-test-velocity-oxc.csv](build-and-test-velocity-oxc.csv), one row per run.

The oxc-project, read on 2026-10-26:

- Oxlint, JS plugins (alpha; no type-aware rules, no custom parsers): https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- Oxfmt, the formatter (Prettier's output as its baseline, about 30x Prettier and 2x Biome, "vendor"): https://oxc.rs/docs/guide/usage/formatter.html
- Oxfmt beta (2026-02-24; 100 percent of Prettier's JavaScript and TypeScript conformance tests, `--migrate biome`, `package.json` sorted by default): https://oxc.rs/blog/2026-02-24-oxfmt-beta
- Vite 8 (2026-03-12; Rolldown and Oxc in place of esbuild and Rollup): https://vite.dev/blog/announcing-vite8
- The releases of oxlint 1.89.0, oxfmt 0.74.0 and @oxlint/migrate 1.89.0 (2026-10-19), oxlint-tsgolint 7.0.2005 (2026-10-22), oxc-transform 0.155.0 (2026-10-19), tsdown 0.23.2 (2026-10-23), Rolldown 1.2.15 (2026-10-21): the npm registry (`npm view <package> time`)

Compilers:

- TypeScript 7.0 announcement and tables: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- TypeScript 7.1 beta: https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/
- VS Code on TypeScript 7: https://code.visualstudio.com/blogs/2026/06/26/iterating-faster-with-ts-7
- Prisma on TypeScript 7: https://www.prisma.io/blog/typescript-7-native-compiler-faster-type-checking
- typescript-eslint and the native compiler: https://github.com/typescript-eslint/typescript-eslint/issues/10940

Linters:

- typescript-eslint, performance of typed linting: https://typescript-eslint.io/troubleshooting/typed-linting/performance/
- ESLint multithread linting: https://eslint.org/blog/2025/08/multithread-linting
- ESLint cache as a pipeline artifact, 54 s to 2.4 s: https://github.com/arcboxlabs/linkcode/pull/312
- Oxlint type-aware linting stable: https://oxc.rs/blog/2026-07-22-type-aware-linting-stable
- Oxlint JS plugins alpha: https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha
- Oxlint, Biome and ESLint benchmarked on one codebase: https://dev.to/fabwaseem/oxlint-vs-biome-vs-eslint-in-2026-benchmarked-on-a-real-nextjs-codebase-3lal
- A migration to Oxlint in an Nx monorepo: https://www.udaynayak.com/blog/migrating-from-eslint-prettier-to-oxlint-oxfmt-in-an-nx-monorepo
- Biome v2 and its type inference: https://biomejs.dev/blog/biome-v2/

Test runners:

- Vitest, improving performance: https://vitest.dev/guide/improving-performance
- Vitest 5: https://vitest.dev/blog/vitest-5
- Vitest, `recordDependencies`: https://vitest.dev/config/experimental
- Vitest, disabling isolation: https://main.vitest.dev/guide/recipes/disable-isolation
- Workers against vCPUs on a 4 vCPU machine: https://github.com/vitest-dev/vitest/issues/5668
- Sharding Vitest in the pipeline (Contentstack): https://developers.contentstack.com/blog/the-waiting-tax-on-every-pr-how-sharding-vitest-cut-ci-from-15-minutes-to-4-5
- Spec files split as atomic shard inputs (NVIDIA): https://github.com/NVIDIA/NemoClaw/pull/8320
- Astro on node:test: https://astro.build/blog/node-test-migration/

Orchestrators and package managers:

- Sentry, the one independent before and after table: https://blog.sentry.io/reduce-ci-time-with-nx-caching/
- Porsche Digital technology radar on Nx: https://opensource.porsche.com/porschedigital-technology-radar/tools/nx/
- Trilium Notes, leaving Nx: https://docs.triliumnotes.org/developer-guide/architecture/adr
- Nx, affected tasks: https://nx.dev/docs/features/ci-features/affected
- Nx, the CREEP vulnerability: https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep
- Nx, self-hosted cache packages deprecated: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- The s1ngularity incident: https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c
- Turborepo, `run` and `--affected`: https://turborepo.dev/docs/reference/run
- moon, affected: https://moonrepo.dev/docs/concepts/affected
- pnpm benchmarks (vendor): https://pnpm.io/benchmarks ; filtering: https://pnpm.io/filtering
- Predictive test selection, the vocabulary of recall (Facebook): https://ar5iv.arxiv.org/html/1810.05286

GitHub Actions:

- Limits: https://docs.github.com/en/actions/reference/limits
- Runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- Cache: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows
- arm64 and x64 runners benchmarked: https://runs-on.com/reference/benchmarks
- Path filters and required checks: https://github.com/orgs/community/discussions/44490

## See also

- [Static analysis and the pipeline](../tools/static-analysis-and-pipeline.md)
- [Quality baseline](../tools/quality-baseline.md)
- [Test runners](../tools/test-runners.md)
- [Sandboxing coding agents](../guides/agent-sandbox.md)
- [Parallel work](../guides/parallel-work.md)
- The pipeline of this repository: [pipeline/README.md](../../pipeline/README.md)
