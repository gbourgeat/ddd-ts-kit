**`init --ci-extras claude-review` and `claude-triage` put Claude Code in the pipeline, on request.**
Two opt-in extras, on both platforms and never installed by default, as the AI-native SDLC
playbook of Anthropic places them: `claude-review` writes `.github/workflows/claude-review.yml`
(`anthropics/claude-code-action` on `pull_request`, pinned to a commit) or a `claude-review` job
of `.gitlab/claude-review.gitlab-ci.yml` (`claude -p`, a note posted through the API), which reads
`REVIEW.md` at the root when it exists and the story file the branch `story/<code>` names, and
posts its findings as one comment that neither approves nor blocks; `claude-triage` writes
`.github/workflows/claude-triage.yml` (on `workflow_run` of `CI` ended in failure) or a
`claude-triage` job `when: on_failure`, which reads the logs of the failed jobs with read-only
tools and writes a three-line triage (the most likely cause, flaky or real, what to do) to the job
summary and on the pull or merge request. Both spend API tokens on every run, through
`ANTHROPIC_API_KEY` or Amazon Bedrock, Google Vertex AI or Microsoft Foundry, and the `gate` job
never needs them: a person still approves. The list is recorded in `ci.extras`; the workflows
were parsed, not executed on the platforms (`pipeline/README.md`).
