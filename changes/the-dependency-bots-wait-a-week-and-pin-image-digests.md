**The Dependabot file `init` writes waits seven days for a release of each ecosystem, and the Renovate preset pins the digest of every container image.** Security updates are not delayed.

To move: add `cooldown: { default-days: 7 }` to each ecosystem of your `.github/dependabot.yml` and `docker:pinDigests` to `extends` of `renovate.json`, or take the new files.
