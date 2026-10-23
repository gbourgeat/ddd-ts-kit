**A story can write its specification without an owner, from an accepted intent, and a workflow
template runs it on the merge of the intent.** `/ddd-ts-kit:story <code> --headless <intent>`
runs phases 1 to 4 alone: every question that changes an artefact is written under
`## Open questions` of the story file with its recommended option taken provisionally and marked
`(provisional, headless)`, the rows, the design review and the acceptance are written and locked,
the build gate stays closed, and the pull request whose body is the list of questions is opened;
the owner answers in the review, and the build phase starts from the merged answers. A new
template, `pipeline/github/workflows/intent-to-spec.yml`, runs it on GitHub when a pull request
merged into the default branch turns an intent to `Status: accepted`: it installs the project,
Claude Code and the plugin, and runs `claude -p` with the `ANTHROPIC_API_KEY` secret, one story
per accepted intent. `init --ci-extras intent-to-spec` writes it (GitHub only, `ci.extras` of the config); the
team adds the secret. It was parsed, not executed on GitHub; opt-in and paid.
