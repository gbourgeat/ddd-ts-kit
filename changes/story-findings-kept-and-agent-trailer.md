**The findings of the review of a story are kept in its design review, and a commit made by an
agent can say so.** At the close of a story, the review of the branch is appended to
`docs/architecture/reviews/<code>.md` under `## Findings`, each finding with its pass, its
`file:line` and its outcome: fixed in `<commit>`, written as `TODO(review)`, or dismissed by
`ADR-<n>`. The record survives the pull request and a move between GitHub and GitLab, and the
rule of two reads it. A new key of the config, `commit.agentTrailer` (`false` by default): when
`true`, the story skill, the `context-builder` agent it briefs and the fix skill end each commit
they make with the trailer `Agent: <host> ddd-ts-kit@<plugin version> <agent name>`, and the
report of a story counts the commits made by an agent against those made by hand. Off by
default because many teams refuse attribution lines in commits; `config/valid` reports a value
that is not a boolean.
