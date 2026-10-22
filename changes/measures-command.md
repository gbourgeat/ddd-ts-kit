**`ddd-ts-kit measures` reads what the loop of each story cost and left.** From the git history of
the current branch and the files of `docs/architecture/` and `test/acceptance/`, per story and as
medians over the period: design time (the first commit of the story file to its acceptance lock),
build time (the lock to the report), lead time (to the commit that carries the branch of the story,
else open), the requirements changed after the build started and the amendments and refusals of the
lock, the provisional decisions, the compromises, the `TODO(review)` markers settled and the
findings of the review file by pass with the repeats across stories, the verification block of the
report, the stories built at the same time, the origin (an intent, a ticket, an incident) and the
incidents repeated: the indicators of the AI-native SDLC playbook of Anthropic in the terms of the
kit. `--since <date>`, `--story <code>`, `--format text|json`; `--by-author` is off by default and
the README says why. Nothing is sent anywhere, and the measures that come from the platform (time to
first review, first-run CI status) are named as not computed.
