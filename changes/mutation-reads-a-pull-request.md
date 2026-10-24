**A pull request gets a reading of its mutation score, the night keeps the whole measure.** The
pipelines of GitHub and GitLab get a `mutation-changed` job on a pull or merge request: it reuses
the report of the last night for what the change leaves alone (Stryker's incremental mode, turned
on by `governedMutation()` when `DDD_TS_KIT_MUTATION_SINCE` names the merge base of the change,
the results kept in `reports/mutation/incremental.json` beside the report), runs everything again
when the change touches code the tests lean on and Stryker does not diff (a fake, a builder, a
world, the platform, a dependency), and lists the survivors of the files the change touched:
`ddd-ts-kit mutation` reads the same variable (`--changed <ref>` says it by hand) and exits 0
whatever the scores, a reading and never a gate, so that `npm run test:mutation` is the one script
of the night and of a pull request. `ddd-ts-kit mutation --survivors` lists every survivor of the
report, where, what mutator and what the code became. `test/mutation-governed` also refuses `incremental` and `force` written by
hand.

To move: add the `mutation-changed` job to your pipeline from `pipeline/github/workflows/ci.yml` or
`pipeline/gitlab/.gitlab-ci.yml`; nothing else changes, the Stryker config spreads
`governedMutation()` already.
