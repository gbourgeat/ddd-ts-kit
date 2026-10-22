# Measures: what each play asks, and `ddd-ts-kit measures`

**Summary.** Every play of the playbook ends with *how to measure it*: a leading indicator
(fast, from the toolchain) and a lagging one (slow, from the pull request history or the
incident tracker). Almost all of them are two git timestamps or a count over committed files,
and the kit commits every artefact they need: the story file with its phases, the design
review, the acceptance lock and its verdicts, the `Slice:` trailers, the `TODO(review)`
markers, the ADRs, the intents and incidents of P1 and P20. One command, `ddd-ts-kit measures`
(P23), would compute them from git and those files, without the platform's API for the
leading ones and with it (`gh`, `glab`) for the lagging ones. This page lists the playbook's
indicators, the kit's equivalent, and what the command would print.

## The playbook's indicators, in the kit's terms

| Play | Leading (playbook) | Lagging (playbook) | Kit, from what |
|---|---|---|---|
| Capture as `intent.md` | time from the first conversation to a committed intent | survival rate into design; intent edits after the first spec commit | intent file creation to `accepted`; intents with a story; intent edits after the story file's first commit (P1) |
| Requirements and design | time between the intent commit and the spec commit | spec commits after the first plan commit | story file first commit to the acceptance lock; criteria edits after the first slice commit; `amend` verdicts |
| Plan mode | share of changes merged from the first pass; plan approval to merge | rework cycles per change; the diff still matches the plan | PRs merged without a post-review commit; design-review pass of `story-check` (P4) without a compromise |
| `CLAUDE.md` | mistakes repeated that the file should have caught | time to a newcomer's first merged PR | findings with the same rule id or remark across two stories (P21 keeps them); first merged PR per new author |
| Skills | policy approval to merged skill | review findings citing the policy, falling to zero | findings by pass of `REVIEW.md` (P14) per month |
| Parallel sessions | concurrent sessions per engineer while review holds | changes merged per engineer per week, with the rework rate | stories open at once per author (`stories`, git); merged stories per author per week; fix stories on their rows |
| Feedback loop | first-pass CI success of agent-written changes | review time per PR; change failure rate | PR green on its first run; report commit to merge; fix stories per merged story |
| Evals | pass rate over time; incident to permanent eval | regressions caught in CI against production | the plugin's eval report (P12); the date of a case against its issue |
| PR review | time to first review; comments resolved without a human on the branch | defects caught before merge against escaped | report commit to first review event; P16 commits against hand commits; blocking findings settled against later fix stories on the same rows |
| Approval gates | time waiting at each gate (OpenTelemetry) | gate violations reaching production | not the kit's (the export); the guide names it |
| CI/CD | pipeline failures triaged without a human | DORA | `claude-triage` summaries against pages (P15); not the kit's |
| Closing the loop | breach to intent in the queue | findings that become merged fixes; repeat incidents | incident date to story first commit; incidents with a merged story; repeats by `message` or `error_code` |

## P23. `ddd-ts-kit measures`

**What.**

```
ddd-ts-kit measures [--since <date>] [--story <code>] [--platform github|gitlab|none] [--format text|json]
```

reads the git history of the trunk and the files of `docs/architecture/` (stories, reviews,
intents, incidents, `slices.md`, the acceptance locks) and prints, per story and as a summary
over the period:

| Measure | From |
|---|---|
| design time | the first commit of `docs/architecture/stories/<code>.md` to the commit of `test/acceptance/<code>.acceptance.lock.json` |
| build time | the lock commit to the report commit (the `## Report` section's first commit) |
| lead time | the story file's first commit to the merge of its pull request (`--platform`), else to the merge commit on the trunk that carries its branch |
| requirements rework | commits that changed `## Acceptance criteria` after the first commit carrying a `Slice: <code>.` trailer; `amend` and `refuse` verdicts in the lock |
| provisional decisions | the `D<n>` lines of the story, and how many the report marks as reversed |
| compromises and drift | the compromises of the report; the rows that failed P4 before passing |
| review | `TODO(review)` markers opened and settled by the story (`story-check` knows them); the findings of `## Findings` (P21) by pass; the repeats across stories (same rule id or same remark, same layer) |
| verification | whether the report's `### Verification` block (P13) names `npm run verify` and the acceptance run |
| parallelism | stories whose worktrees overlapped in time, per author (from the first and last commit of each) |
| origin | the share of stories with an intent, a ticket or an incident in `## Origin` (P2) |
| repeat incidents | fix stories whose origin names an incident with the same `message` or `error_code` as an earlier one |
| with `--platform` | time to first review, PR green on first run, comments resolved by P16 against by hand, from `gh` or `glab` |

`--json` gives the same for a dashboard; `--format text` prints a table per story and the
period's medians. Nothing is sent anywhere; the platform calls are reads, and only with the
flag.

**Why.** The playbook's measures are what let a team say the loop pays, and what let a tech
lead tune the setup *once a month* as the review play asks. The kit has made every artefact a
file precisely so that tools can read them; this is the reading. It also closes the rule of two
(P5): a repeat the command lists is a line of `AGENTS.md` or a rule the team has not written
yet.

**What it is not.** Not a productivity score per person. The playbook's lagging measures are
per engineer; the command prints per author only with `--by-author`, off by default, and the
guide says why (a measure read per person changes what people do).

**Cost.** Medium: most inputs are parsed already (`story`, `story-check`, `acceptance`,
`stories`); the new work is the time dimension from git and the platform reads. One command,
one page in the commands guide, a test on the scheduling example's history.

## Session-level measures: the OpenTelemetry export

The playbook reads concurrent sessions, hook decisions and gate waits from Claude Code's
OpenTelemetry export, forwarded to the organisation's observability stack. That is outside the
kit: the [sandbox guide](../../guides/agent-sandbox.md) or the coding-agents guide should say,
in one paragraph, that the export exists, that the guard's decisions appear in it as hook
events, and which of the playbook's measures come from there and not from `measures`. The
kit's own `@ddd-ts-kit/tracing` package is for the application, not for the sessions that
build it; the two stacks can share a collector.
