# Branch protection (GitHub)

The workflows only report. These settings make them binding. Nothing here is applied
automatically: run the commands once, as a repository administrator, after the first green run
of `CI` on `main` (GitHub only offers a check as "required" once it has reported).

## What is required

| Check | Workflow | Why it is the required one |
|---|---|---|
| `gate` | `ci.yml` | Needs every other job of the workflow; a failed, cancelled or skipped job fails it. One required check, so adding a job never needs a settings change. |
| `Conventional title` | `pr-title.yml` | The squash commit takes the pull request title. |
| `Analyze` | `codeql.yml` | Only with `init --ci-extras codeql`: require it when code scanning is enabled on the repository. |

## Protect `main`

```bash
gh api --method PUT "repos/{owner}/{repo}/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "gate" },
      { "context": "Conventional title" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

`{owner}` and `{repo}` are filled in by `gh` from the current repository. A solo maintainer sets
`required_approving_review_count` to `0`.

## Squash only, title as commit subject

```bash
gh api --method PATCH "repos/{owner}/{repo}" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY
```

## Control

```bash
gh api "repos/{owner}/{repo}/branches/main/protection" \
  --jq '{checks: [.required_status_checks.checks[].context], strict: .required_status_checks.strict, admins: .enforce_admins.enabled}'
```

Expected: `{"checks":["gate","Conventional title"],"strict":true,"admins":true}`.

## Notes

- Not installed by default, because they need a paid plan on a private repository:
  dependency review (`--ci-extras dependency-review`: free on public repositories, GitHub Code
  Security or GitHub Advanced Security on private ones) and CodeQL (`--ci-extras codeql`: free on
  public repositories, GitHub Code Security on private ones). `npm run ci:audit` and gitleaks
  hold dependencies and secrets on every plan.
- Secret scanning in `ci.yml` runs the gitleaks container, which needs no licence. The
  `gitleaks/gitleaks-action` wrapper is not used: it asks organization accounts for a licence
  key (free, by its README) and is no longer MIT.
- Dependabot (`dependabot.yml`) is GitHub only. `renovate.json` works on both platforms; keep one
  of the two, not both.
