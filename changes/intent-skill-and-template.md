**An idea enters the kit as an intent, before any story.** A new skill, `/ddd-ts-kit:intent`,
brainstorms with whoever has the idea until it is concrete (the problem, the outcome, who and
what it touches, the constraints, what the author would observe), maps the affected systems on
`npx ddd-ts-kit list` when it runs inside the project, and writes
`docs/architecture/intents/<slug>.md` from a new template of the story skill
(`intent-template.md`) with `Status: draft`. It runs from Claude Code, Cowork or claude.ai with a
git connector, and the template is also filled by hand. The product owner accepts the intent by
setting `Status: accepted` in a pull request. The story skill reads it:
`story-scope <code> --from <intent>` records the origin, the `## Problem` and `## Proposed
outcome` of the intent seed `## Statement`, each constraint is listed as a question answered "by
the intent", the open questions join the owner's batch, and the acceptance lines are the first
draft of the criteria. The story workflow guide says where a story comes from, and the
methodology says it at step 7.
