**The guard lets `generate module` through on the trunk, and the skills name modules, the authorization model and the preset's glossary.**
`generate module` writes the config and the `CONTEXT.md` of the context, not code, so the guard no longer refuses it on the main checkout
under `"worktrees": "required"`, as it already did for `generate context`. The `bootstrap` skill declares each module of a context
right after its `generate context`, with its `--term`. `plan-slices` gives every row of a context with modules a `--module`, and leaves
`--grant` out on a `rebac` or `abac` project, where the generator refuses it. `glossary` takes the terms of a preset (today `identity`,
`packages/cli/src/presets/identity-terms.ts`) as the draft of a context the preset writes, and adds only the business terms beyond them.
