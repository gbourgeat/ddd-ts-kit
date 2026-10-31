# Acceptance of a story, before its code

Read when writing or changing the acceptance spec of a story, or when a locked scenario seems wrong.

The criteria are written first, in `docs/architecture/stories/<story>.md` under
`## Acceptance criteria`, one item each: `- AC1: <what a client observes>`. Then
`npx ddd-ts-kit generate acceptance <story>` writes `test/acceptance/<story>.acceptance.spec.ts`,
an `it.todo` per criterion. Each becomes one or more scenarios through the API only
(`test/acceptance-black-box`): routes, answers, problem documents, integration events. Title:
the rows that make it pass, then the criterion, `'#US5.02 AC1 a customer places an order'`.
Body wrapped in `pending(...)` of `@ddd-ts-kit/testing/e2e`: run
`npm run test:e2e -- test/acceptance` and see each fail on an assertion (a scenario that passes or
throws a `TypeError` fails the run). `npx ddd-ts-kit acceptance <story> --gate written` names
what is left; once nothing is, `npx ddd-ts-kit acceptance <story> --lock`, and commit the spec and
its lock together, before any code of the story.

The slice that satisfies a scenario removes `pending(...)` in its commit, nothing else. A locked
scenario is never changed to make code pass. When one seems wrong, compare it with its criterion:

| What is wrong | Do |
|---|---|
| the code | fix the code; the scenario stays |
| the specification changed | change the criterion in the story file, then its scenarios |
| the scenario does not say what its criterion says | fix it |

Then launch the `ddd-ts-kit:acceptance-judge` agent on each change `npx ddd-ts-kit acceptance
<story>` reports (its subject and fingerprint): it compares the locked version, the new one, the
criterion and the owner's answers, and writes `Verdict: amend` or `refuse`. `--lock` refuses
every changed criterion, and every scenario changed while its criteria were not, without an
`amend` verdict on that very version; the verdicts become amendments the owner validates. A
`refuse` means restore it (git). Nobody but the judge writes a verdict, and a sub-agent never
changes a scenario nor locks: the guard refuses all three. A host without the agents of the
plugin asks the owner to write the verdict.
