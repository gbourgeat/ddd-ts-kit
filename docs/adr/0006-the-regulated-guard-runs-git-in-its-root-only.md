**English** · [Français](0006-the-regulated-guard-runs-git-in-its-root-only.fr.md)

# ADR-0006: the regulated guard runs git in its root only

## Decision

Under [the regulated profile](../guides/agent-sandbox.md#the-regulated-profile), the guard of the plugin runs git in one repository: the repository of the session root. The session root is the folder Claude Code started the session in, which it gives its hooks as `CLAUDE_PROJECT_DIR`, or else the working directory the host sends. The guard finds that repository with `git rev-parse --show-toplevel`, run from the root. A checkout is in it when its git files lead to the same common git directory, so a linked worktree under `.worktrees/` is in it. A nested repository, a submodule and a worktree of another repository each have their own common directory. The guard runs no git there, at any hook, and the session start and the stop say that the project there is not read. In the repository of the root, `git status` and `git diff` run with `--ignore-submodules=all`, so that git does not run again in each submodule. Every git the guard runs, the runs of a builder included, keeps `-c core.fsmonitor=false`, `-c core.hooksPath=/dev/null` and `--no-optional-locks`.

The profile counts when the session root or the place states it. Under the default profile the guard runs git where it did before, in the repository each hook finds.

## Why

Hooks run outside the sandbox, and git honours the config of the repository it runs in, where a filter or a diff driver names a program. The sandbox of Claude Code keeps its commands from writing `.git/config` and `.git/hooks` in the working directory of the session, and in the shared git directory of its worktrees ([Protected paths](https://code.claude.com/docs/en/sandboxing), read on 2026-11-01). It protects the config of no other repository, nor that of a submodule, kept under `.git/modules/`, and git reads the files of each submodule when it compares those of the superproject. So the config of the repository of the session root is the one the guard can trust, and it runs git there only.

Git has no switch that turns every filter or diff driver off. `-c filter.<name>.clean=` blanks one driver whose name is known in advance. `--attr-source` changes where the attributes are read, not which drivers the config defines. `--no-ext-diff` and `--no-textconv` leave the clean filter alone. Reading the config to blank each driver it names would chase every kind of driver git has or adds (`clean`, `smudge`, `process`, `textconv`, `command`), and a name `-c` cannot spell, one that holds `=`, would still run. So the guard keeps to a rule it can hold: the repository of the root, whose config it trusts as the sandbox protects it, and no other.

## What it costs

- In a project outside the repository of the session root, the guard reads no git: no reminder of the size of a commit, no comparison of what the command of a worker changed, no branch of a worker read. The session start and the stop say it.
- A change inside a submodule is not seen by the guard: it compares the files of the root only.
- The rule holds as far as the sandbox protects the root. Claude Code protects `.git/config` and `.git/hooks` in the working directory only. A session started in a subfolder of a repository leaves the config at the top of that repository within reach of a sandboxed command. Under Codex and Copilot the guard knows of no file that turns their sandbox on, so it cannot tell whether the config of the root is out of reach of a command there.
- The guard trusts the global config of the developer and the config the repository of the root includes (`include.path`), as git does.
- A worktree of the repository of the root with `extensions.worktreeConfig` set reads a `config.worktree` under `.git/worktrees/`, which the sandbox does not protect. Only a developer sets that extension, in the protected config.

## What would reverse it

A switch of git that runs no program the config names, for reads such as `status` and `diff`. The guard would then run git in every repository with that switch, nested ones and submodules included. A host that protected the config of every repository below its working directory would reverse it too.
