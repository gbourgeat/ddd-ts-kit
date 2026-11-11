**`status` names the rows in progress before the next one, and `plan-waves` names the command that opens the worktree of the conductor.**

- During the build, `Next:` of `ddd-ts-kit status` proposed the first `todo` row ready on the trunk even while rows were in progress, as if they were not there. It now reads `#US1.01 in progress; once landed, the next row ready on the trunk, #US1.02 ...`.
- A batch of the conductor in `plan-waves` said `on the trunk, by the conductor`, and the guard then refused the code of a context in the main checkout. The line now ends with where that work is done: `in the worktree of the plan (npx ddd-ts-kit worktree <plan>)`.
