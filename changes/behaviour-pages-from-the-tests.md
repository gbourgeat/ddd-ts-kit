**The tests are read back as a document: `ddd-ts-kit docs` writes `docs/behaviour/`, one page per
context of what its tests state.** Each page lists, in the words of the test titles, the rules of
the context grouped as the specs group them (`describe` and `it`, a table of cases as one rule), with
the role of each spec (`slot (value object), in calendars`), a planned rule (`it.todo`) and a spec
put aside said so, and the counts; `docs/behaviour/application.md` does the same for the specs
outside the contexts (end to end, acceptance, architecture) and `docs/behaviour/README.md` indexes
them. `npm run docs:generate` writes them with the other generated documents and `docs --check`
holds them current, so a spec whose title changed is a page to regenerate and commit with it. This
is the reading the business asks of Gherkin, without a second language to keep in step: the title of
a test, which `test/title-states-a-rule` makes a rule, is the sentence. Under `generate --local-only`
the pages are left to the trunk, as every shared file is.

To move: run `npm run docs:generate` once and commit `docs/behaviour/`.
