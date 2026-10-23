**A pull request is taken to green by `/ddd-ts-kit:pull-request <number>`.** From the worktree of
the story, the new skill sweeps the unresolved review comments and the failing checks of the
pull request, addresses each under the rules of the story (a change the design review did not
foresee becomes a `D<n>` decision, a request to weaken a check goes through the `deviation`
skill, a failing check is fixed in the code and never in the check, no force-push), replies to
each thread, pushes, waits for the checks, and repeats until the pull request is green and waits
only on the code owner; it then reports what was changed and what was declined and why. The
story skill names it as the step after `gh pr create`, when the owner asks for it.
