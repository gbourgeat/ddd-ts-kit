# Review remarks

Read when a review reports findings, for a `TODO(review)` marker, or before closing a story or a milestone.

A review sorts its findings: a blocking one is fixed before the merge; a non-blocking one is
settled at once, or written before the merge as `TODO(review): #<row id> <remark>` at the line it is
about, by whoever fixes the branch (the `architecture-reviewer` agent gives the line and its
`file:line`, and never writes it), never left in the body of a pull request. A slice may merge with `TODO(review)` markers; a story or a
milestone is closed only when `npx ddd-ts-kit story-check <code>` exits 0: every marker of its
own handled, or dismissed by a decision record (`npx ddd-ts-kit generate adr "<title>"`,
quoting the remark without its marker) with the marker deleted in the same commit. A marker is
the story's when its text names one of its rows (the `#<row id>` above), else when the commit that
wrote its line does (its `Slice: <row id>` trailer, else its message), else, not committed, when
the worker whose worktree holds it was briefed on one of its rows. One that belongs to no row
blocks only when no other open story has a row in its context; otherwise `story-check` lists it
without blocking: settle it, or name its row in it. `--strict` blocks on every marker of the
story's contexts. The rule of two: a finding that repeats one already recorded for the project
(the same rule id, or the same remark on the same layer, in an earlier
`docs/architecture/reviews/*.md` or as a `TODO(review)` marker) is written as one line under
`## Mistakes seen here` of `AGENTS.md`, or as the config change when a rule of the kit covers
it, in the commit that settles it; the reviewer gives the line.
