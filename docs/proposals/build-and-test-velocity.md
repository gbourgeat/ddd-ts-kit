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

## Status (2026-10-23)

**Studied, not built.** The measures and the sources are kept here; each line of the plan is a
pull request of its own, measured against the indicators of this page before and after.

| Part | Verdict |
|---|---|
| Fewer jobs per pipeline run, the heavy families narrowed on a pull request | **recommended first** (the queue and the wall clock) |
| The compile matrix of five spec files run in parallel or split per file | **recommended** (the longest file, 84 s, caps every run) |
| Half the cores outside a pipeline, `related` tests before a push | **recommended** (the memory of a laptop) |
| ESLint with its content cache, kept as an artifact of the pipeline | **recommended** (measured on this repository, section 5) |
| The type check of the specs in parallel | **recommended** (measured, section 5) |
| Oxlint with tsgolint, the rules of the kit loaded as a JS plugin | **beside ESLint only**: 2 to 4 s instead of 35, but the kit plugin breaks on 2,494 files under the alpha plugin API (section 5) |
| arm64 runners for the unit and end-to-end jobs | **to try**, ten runs compared |
| pnpm for this repository | **not now**: 1 s instead of 8 s per install, behind the same cache restore; the filter it offers exists already |
| Nx, Turborepo, moon, Lage, Rush | **no**: nothing left to cache, the affected selection exists, a remote cache costs or exposes |
| Biome as the linter, bun test or node:test as the runner | **no**: types, native modules and coverage |

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

Oxlint reads the whole tree in 2 s and its typed rules in 4 s, against 35 s for ESLint: the
speed reported by the other teams holds here. The findings do not: with the rules of
typescript-eslint and of ESLint alone, 16 to 17 findings appear that ESLint does not report,
one rule to turn off (`no-redeclare`) and three to examine; with the rules of the kit loaded
through the JS plugin API, which is alpha, the plugin breaks on 2,494 of the files and the
stepdown rule reports 43 findings ESLint does not. The findings parity is not there, and until
the plugin runs whole under that API, Oxlint cannot be the gate of a project that uses the
kit. It can run beside ESLint, not blocking, to measure the gap as the API matures.
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
| the unit job sharded in two with `--reporter=blob` and the floors on the merged report | the longest job of the trunk shortened | one more job against the limit of 20: after the merge of the small ones | **do, after the first line** |
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
6. **Two shards for the unit job**, once the first line has freed the queue. Indicator: wall
   time of the longest job of the trunk.
7. **Two trials, non-blocking and measured for a month**: Oxlint with tsgolint and the kit
   rules as a JS plugin, its findings compared with ESLint's on every run, starting with the
   reason the plugin breaks under that API (a rule that reads something the alpha does not
   carry), reported upstream or worked around in the plugin; the unit and end-to-end jobs on
   `ubuntu-26.04-arm` on the night runs, their p50 compared with the x64 runs. Each ends with a
   verdict written on this page.

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

## Still to verify

- The findings of Oxlint with the kit rules as a JS plugin against ESLint's, on this tree and
  on a generated project, over several weeks of changes.
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
Actions (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`).

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
