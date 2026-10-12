# Merge request settings (GitLab)

The pipeline only reports. These project settings make it binding. Nothing here is applied
automatically: run the commands once, as a project maintainer. `glab api` replaces `:id` with
the project of the current directory; with `curl`, use
`--header "PRIVATE-TOKEN: <token>" "https://gitlab.example.com/api/v4/projects/<id>"`.

## Pipelines must succeed, squash, resolved threads (every tier)

```bash
glab api --method PUT "projects/:id" \
  -f only_allow_merge_if_pipeline_succeeds=true \
  -f allow_merge_on_skipped_pipeline=false \
  -f only_allow_merge_if_all_discussions_are_resolved=true \
  -f squash_option=always \
  -f merge_method=ff \
  -f remove_source_branch_after_merge=true \
  -f auto_cancel_pending_pipelines=enabled \
  -f squash_commit_template='%{title}'
```

- `only_allow_merge_if_pipeline_succeeds` is what turns the whole pipeline, and so its final
  `gate` job, into the required check. GitLab has no per-job required check on the Free tier:
  the pipeline status is the unit.
- `squash_option=always` with `squash_commit_template='%{title}'` makes the merge request title
  the commit subject, which the `merge-request-title` job holds to the conventional format.
- `auto_cancel_pending_pipelines` is the project side of `workflow:auto_cancel` and
  `interruptible: true` in `.gitlab-ci.yml`.

## Protected default branch (every tier)

```bash
glab api --method DELETE "projects/:id/protected_branches/main"
glab api --method POST "projects/:id/protected_branches" \
  -f name=main \
  -f push_access_level=0 \
  -f merge_access_level=40 \
  -f allow_force_push=false
```

`push_access_level=0` means nobody pushes: every change goes through a merge request.
`merge_access_level=40` is Maintainer; use `30` to let Developers merge. The `DELETE` is needed
because a new project protects its default branch already and the rule cannot be created twice.

## Commit messages (Premium and Ultimate)

Push rules are a Premium feature. They reject non-conventional commits on the server:

```bash
glab api --method POST "projects/:id/push_rule" \
  -f commit_message_regex='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9-]+\))?!?: .+' \
  -F prevent_secrets=true \
  -F reject_unsigned_commits=false
```

Use `--method PUT` when a push rule already exists. On the Free tier the same rule is held on
the client by the `commit-msg` hook of `lefthook.yml` and, for what reaches the default branch,
by the squash setting above together with the `merge-request-title` job.

## Approvals (Premium and Ultimate)

```bash
glab api --method POST "projects/:id/approval_rules" -f name=Review -F approvals_required=1
```

On the Free tier approvals are optional and cannot be enforced.

## Control

```bash
glab api "projects/:id" | jq '{only_allow_merge_if_pipeline_succeeds, allow_merge_on_skipped_pipeline, squash_option, merge_method, only_allow_merge_if_all_discussions_are_resolved}'
glab api "projects/:id/protected_branches/main" | jq '{name, allow_force_push, push: [.push_access_levels[].access_level], merge: [.merge_access_levels[].access_level]}'
```

## Scanners and tiers

| Piece | Free | Premium | Ultimate |
|---|---|---|---|
| SAST template (`Jobs/SAST.gitlab-ci.yml`, Semgrep rules for JavaScript and TypeScript), `--ci-extras gitlab-sast` | job runs, report downloadable as an artifact | same | findings in the merge request, vulnerability management, Advanced SAST |
| Secret Detection template (`Jobs/Secret-Detection.gitlab-ci.yml`), `--ci-extras gitlab-secret-detection` | job runs, report downloadable as an artifact | same | findings in the merge request and the security dashboard |
| Dependency Scanning template (`Jobs/Dependency-Scanning.v2.gitlab-ci.yml`), `--ci-extras gitlab-dependency-scanning` | not available: the `include` is skipped | not available | available |
| Code Quality report (ESLint and architecture) | merge request widget | plus the pipeline report tab | plus inline in the changes view |
| JUnit report, coverage percentage, Cobertura coverage in the diff | available | available | available |
| Push rules | no | yes | yes |
| Required approvals | no | yes | yes |

The three templates are not in `.gitlab-ci.yml` unless `init --ci-extras` names them: on Free
and Premium their findings reach no merge request, and their jobs are `allow_failure: true` by
design of GitLab, so they never block a merge. What blocks, on every tier, is the `audit` job
(`npm audit`, production dependencies, high and above) and the `secrets` job (gitleaks).
