# changes

What a pull request changes for someone who uses the kit, written by that pull request in a file
of its own: `changes/<what-it-does>.md`, named after the change in kebab-case. `CHANGELOG.md` is
written by the release, which folds these files into the section of the new version, in the order
they reached `main`, and deletes them (`node pipeline/monorepo/release-version.mjs --set`).

Two pull requests never write the same file, so a merge never makes another one conflict, and a
pull request that was green stays mergeable as it is.

A file holds the entry as `CHANGELOG.md` shows it: it opens with the change in bold, then the
detail, then `To move:` when a project has to act.

```md
**`ddd-ts-kit lint` names the file of each finding it reports.** ...

To move: ...
```

The CI checks a pull request (`node pipeline/monorepo/changes.mjs --check --base <ref>`): it has no
edit of `CHANGELOG.md` and no new `version` of `plugin/.claude-plugin/plugin.json`, a change under
`plugin/` comes with a file here, and each file opens with its summary in bold. A file is read in
`CHANGELOG.md`, at the root of the repository, and in the CLI package that copies it: a link names
its page from the root (`docs/concepts/personal-data.md`, never `../docs/...`) and leads to a file
that exists, and a package of the kit is named as it is published, the name of its `package.json`
(`ddd-ts-kit` for the CLI, `@ddd-ts-kit/eslint-plugin`). The release is the pull request that sets
the version, and writes both.
