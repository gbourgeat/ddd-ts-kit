**The plugin has an eval suite, off by default.** `plugin/evals/` holds twelve cases for
`claude plugin eval`, one per promise of the skills, the agents and the guard (the generator rather
than the hand, the glossary before a name, a deviation refused, a worker that stays in its context,
the reviewer that finds planted violations with `file:line`, wiring without a token, cross-cutting
out of the handler, `describe` instead of a tree walk, no code before the design review and the
lock of a story, an acceptance scenario never rewritten, commits split by context, a violation
fixed at the root cause): each a prompt on the scheduling example and graders that read what the
session did, as the AI-native SDLC playbook of Anthropic asks of agent configuration. Nothing runs
by default: each case is a full Claude Code session in two arms (24 sessions for a run of the
suite with `--runs 1`, 72 with the default of 3). A maintainer runs it by hand from the Actions tab
(`agent-evals.yml`, `workflow_dispatch` only, green and idle until the secret `ANTHROPIC_API_KEY`
exists, a ceiling of 10 USD, threshold 0.8), or one case locally on their own credential with
`claude plugin eval plugin --runs 1 --no-publish --max-cost-usd <n> --case <name>`. `CONTRIBUTING.md`
says how a case is written, that every reported regression becomes a case before its fix, and what
a run costs; the coding-agents guide says a project can hold its own skills to the same test.
