**The generated GitHub workflows keep no token in the checkout, read the base branch of a pull request through the environment, and the two Claude jobs hold no identity token.** `persist-credentials: false` is on every checkout but the one of `intent-to-spec`, which pushes its branch. `claude-review` and `claude-triage` no longer declare `id-token: write`; a project that reaches the model through a cloud provider with an identity token adds it back to the job.

To move: run `init --force` to take the new workflows, or add `persist-credentials: false` to your checkouts.
