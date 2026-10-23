**`ddd-ts-kit lint` keeps the cache of ESLint, and the pipeline of a project restores it.** The
command lints with the cache of ESLint keyed by the content of each file (`.eslintcache/`, ignored
by git): a second run on a tree that did not change lints the files that changed since, in a
second or two instead of the whole project. The cache keys on the files and the config, not on the
rules as installed, so the command drops it when the lockfile, `eslint.config.mjs` or
`ddd-ts-kit.config.json` changed since it was written. The lint job of the pipeline `init` writes
restores, on a pull request or a merge request, the cache the default branch wrote last for the
same lockfile and config, and the default branch and the night lint everything and write it: a
type changed in another file is seen there.

To move: add `.eslintcache/` to `.gitignore`, and give the lint job of the pipeline the two cache
steps of the template (`ddd-ts-kit init --force` rewrites `.github/workflows/ci.yml` or
`.gitlab-ci.yml`).
