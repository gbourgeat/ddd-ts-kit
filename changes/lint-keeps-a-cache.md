**`ddd-ts-kit lint` keeps the cache of ESLint, and the pipeline of a project restores it.** The
command lints with the cache of ESLint keyed by the content of each file (`.eslintcache/`, ignored
by git): a second run on a tree that did not change lints the files that changed since, in a
second or two instead of the whole project. The cache keys on the files and the config, not on the
rules as installed, so the command drops it when the lockfile, `eslint.config.mjs` or
`ddd-ts-kit.config.json` changed since it was written. The lint job of the pipeline `init` writes
restores, on a pull request or a merge request, the cache the default branch wrote last for the
same lockfile and config, and the default branch and the night lint everything and write it: a
type changed in another file is seen there. `ddd-ts-kit lint --no-cache` lints every file again.

To move, by hand, not with `init --force`, which rewrites far more than the pipeline: add
`.eslintcache/` to `.gitignore`; in `.github/workflows/ci.yml`, give the lint job the two steps of
the template (`actions/cache/restore` of `.eslintcache/` before the lint, on a pull request only,
keyed by the lockfile, `eslint.config.mjs` and `ddd-ts-kit.config.json` with a prefix fallback;
`actions/cache/save` after it, on the default branch and the night only), as
`node_modules/ddd-ts-kit/templates/pipeline/github/workflows/ci.yml.tpl` writes them; in
`.gitlab-ci.yml`, add the second `cache:` entry of the lint job (`.eslintcache/`, keyed by the
lockfile and `eslint.config.mjs`, `policy: $LINT_CACHE_POLICY`) and the `LINT_CACHE_POLICY` variable
of each workflow rule (`pull` on a merge request, `pull-push` on the default branch and the night),
as `templates/pipeline/gitlab/gitlab-ci.yml.tpl` writes them.
