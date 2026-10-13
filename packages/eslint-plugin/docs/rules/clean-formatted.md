# clean/formatted (layout)

Architecture id: `clean/formatted`. No severity: a file is formatted or it is not. Fixable with `npm run format`.

Applies to: every TypeScript, JavaScript and JSON file of the project.

Not a rule of this plugin, and not a rule of ESLint: the formatter of the project, [Biome](https://biomejs.dev), holds it with the `biome.json` that `ddd-ts-kit init` writes.

## Why

One way to lay out a file leaves nothing to discuss in a review and nothing to decide while writing: a line is at most 120 columns wide, and a diff shows what changed, never how somebody likes their line breaks.

## Checked

- `npm run format:check` (`biome format .`) reports nothing to change; it runs on staged files before a commit, in `npm run verify` and in the lint job of the pipeline
- `npm run format` (`biome format --write .`) settles it

The settings: line width 120, two spaces, LF, single quotes, trailing commas, semicolons, parentheses around the parameter of an arrow function. The linter and the import organiser of Biome are off: ESLint with this plugin is the only linter, and the formatter never reorders an import.

## With ESLint

The presets enable no rule that decides where a token goes, so the two never fight: `biome format --write` then `eslint --fix` then `biome format` reports nothing to change. What ESLint keeps is what a formatter does not decide: the blank lines between statements ([`clean/blank-lines`](clean-blank-lines.md)) and the braces of a branch ([`clean/braces`](clean-braces.md)).

## Limits

- Markdown and YAML are not formatted.
- Generated artifacts compared byte for byte by their own check (`openapi/*.json`, `openapi/forms/`, `asyncapi.json`, `.dependency-cruiser.cjs`) and build outputs are left out in `biome.json`.
- A string literal, a URL or a regular expression longer than 120 columns stays on its line: a formatter does not cut a token.

## With the CLI checker

`ddd-ts-kit rules` lists the id and `ddd-ts-kit explain clean/formatted` says who decides; `ddd-ts-kit check` judges nothing here.
