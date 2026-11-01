**English** · [Français](0004-the-regulated-guard-runs-no-program-of-the-project.fr.md)

# ADR-0004: the regulated guard runs no program of the project

## Decision

Under the regulated profile the guard of the plugin (`plugin/hooks/guard.mjs`) starts, at no hook, the `ddd-ts-kit` or the Biome of `node_modules`. The rules the guard reads itself keep running: a generated file, the scope of a worker, the lock of a fix, the size of a commit. The entry of the change is `changes/the-regulated-guard-runs-no-program-of-the-project.md`.

The profile is read by `isRegulated`, at the root of the project and in every folder above it, from:

- `agents.profile` set to `regulated` in `ddd-ts-kit.config.json`;
- `.claude/settings.json` at the same levels, where `sandbox.enabled: true` with `sandbox.allowUnsandboxedCommands: false` counts as the profile.

The sandbox of Claude Code denies its commands a write to `.claude/settings.json` in their working directory and above, so a command that rewrites the config, or leaves another one lower down, does not bring those runs back. No `denyWrite` line holds `ddd-ts-kit.config.json` itself: `generate context`, `sdk` and the presets write it from inside the sandbox, which was measured. Such a line would stop the CLI from doing its work.

## Why

Hooks run outside the sandbox, and a sandboxed command may write the project. A program started from `node_modules` by a hook therefore has the rights of the developer, not those of the sandbox. Under the profile that exists to keep the agent inside its limits, the guard keeps to what it reads itself and starts nothing the project holds. The regulated organisation can state, in one sentence, what the guard executes: its own file.

## What it costs

No check at the write and none at the stop under this profile. `check-file` after a write does not run, with `formatOnWrite` and `dependenciesBeforeWrite`. `check` does not run when a turn ends, so a turn is no longer refused for architecture errors. The build gate and the next step of a story, the map of the contexts and the workers to resume are not answered.

What holds instead: the session start says so in one line, a stop neither blocks on a check that did not run nor says it ran, `doctor` reports what it did, an agent runs `npx ddd-ts-kit check` in the sandbox, and the pipeline and the commit gate hold those checks. A project that relied on `formatOnWrite` formats at the commit.

On Codex and Copilot no `.claude/settings.json` exists, so `agents.profile` is the only sign there.

## What would reverse it

A CLI the guard can verify before it runs it (a pinned digest the profile states, held outside the project), or a hook runtime that starts commands inside the sandbox, would let the checks come back at the write and at the stop. See [Sandboxing coding agents](../guides/agent-sandbox.md).
