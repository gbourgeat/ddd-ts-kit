**English** · [Français](agent-sandbox.fr.md)

# Sandboxing coding agents: security and machine load

**Summary.** A coding agent runs commands on your machine with your rights: it can read your
keys, reach any host and, with several workers at once, take every core and every gigabyte
until the machine stalls or restarts. The guard of the plugin is not a security boundary (it
fails open by design); a sandbox is. This guide says what loads a machine in a ddd-ts-kit
project and what the kit already does about it, then three levels of isolation, from a
resource cap to a full sandbox: the sandbox of the agent itself, and
[NVIDIA OpenShell](https://docs.nvidia.com/openshell/), the one this guide suggests when the
security of a session matters. What it says about OpenShell was read in its documentation on
2026-10-19, for version 0.1.4.

## What loads the machine, and what the kit does

| Load | When | What the kit does |
|---|---|---|
| unit specs and their coverage | before each push (lefthook) | the hook runs `ddd-ts-kit affected --base origin/HEAD --run ci:test:unit`: the specs of the contexts the branch reaches and of the ones downstream of them, as on a pull request; everything when git cannot tell; nothing when only documents changed. The pipeline still runs everything on the trunk and every night |
| workers of the test runner | each run | outside a pipeline (no `CI` variable) Vitest and Jest take half of the cores (`maxWorkers: '50%'` in the generated config, and in the kit's own `vitest.config.ts`); `VITEST_MAX_WORKERS=2`, or `--maxWorkers=2` for Jest, sets the number |
| several agents at once | [parallel work](parallel-work.md) | each worker has its worktree with its own `node_modules`, compiler, linter and test runner: the load is multiplied by the number of workers. Run the waves of [Waves and batches](parallel-work.md#waves-and-batches) with as many workers as the machine holds, not one per context |
| the architecture check at the end of a turn | the `Stop` hook, when changes are pending | one `ddd-ts-kit check` of the project, at most 60 seconds; nothing to tune |
| the editor | always | an IDE indexes every worktree of `.worktrees/` with its `node_modules`: mark the folder excluded |

To size the waves, run one `verify-slice` of a worker and watch its peak of memory: the
number of workers is what the free memory holds of that peak, with a margin.

A machine that restarts rather than killing a process is often too hot or short of power, not
out of memory: Linux kills a process when memory runs out. After a restart,
`journalctl -k -b -1 | grep -iE "oom|thermal|mce"` says which.

## Three levels of isolation

| | Resource cap | Sandbox of the agent | NVIDIA OpenShell |
|---|---|---|---|
| Protects | the machine from overload | files and hosts reached by shell commands | files, network, credentials and system calls of the whole agent |
| CPU and memory | yes | no | yes (`--cpu`, `--memory`) |
| Hooks, file tools, MCP servers | capped | outside the boundary | inside the boundary |
| Credentials | visible to the agent | visible unless denied | injected by the gateway, never seen by the agent |
| Your files | in place | in place | copied in and out, or cloned inside |
| Cost to set up | one command | one setting | an image and a policy |

### 1. Cap the resources (Linux)

Start the agent in a systemd scope: everything it starts, workers, test runners and
compilers included, shares the cap, and the kernel kills inside the scope instead of
stalling the machine.

```sh
systemd-run --user --scope -p MemoryHigh=10G -p MemoryMax=12G -p CPUQuota=600% claude
```

About 70% of the memory and one `100%` per core you give it. `earlyoom` or `systemd-oomd`
kills earlier than the kernel. This protects the machine, not your data: the agent keeps
your rights.

### 2. The sandbox of the agent

Claude Code has a sandbox of its shell commands: `/sandbox` in a session, or
`"sandbox": { "enabled": true }` in its settings. On Linux it needs `bubblewrap` and `socat`.
It limits the files a command writes and the hosts it reaches through a proxy
(`network.allowedDomains`: the npm registry and your git host for a ddd-ts-kit project).
Hooks, file tools and MCP servers run outside it, and it does not limit CPU or memory: pair it
with level 1. See [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing).
Codex has its own sandbox modes.

#### The regulated profile

`npx ddd-ts-kit init --agent-profile regulated` writes this level into the project, as the
worked example of the AI-native SDLC playbook of Anthropic
([PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf))
lays it out for a regulated organisation, and records it as `agents.profile` in
`ddd-ts-kit.config.json` ([`ddd-ts-kit.config.json`](../CONFIG.md#working-agreements)). It
applies to a project already initialised, without `--force`, and `--agent-profile none` removes
it. With the profile, `.claude/settings.json` gains a `sandbox` block next to the permissions
(a key the project already set is kept), and `init` prints the block of managed settings a
project file cannot set, for the platform team to paste; `ddd-ts-kit doctor` reports a project
whose settings lack a line of the block (`--strict` fails on it). What each line buys, in control
terms:

| Line | Where | What it buys |
|---|---|---|
| `sandbox.enabled: true` | `.claude/settings.json` | every shell command of the agent runs in the sandbox (bubblewrap and socat on Linux): it writes where the sandbox allows and reaches the network through its proxy |
| `sandbox.failIfUnavailable: true` | project | on a machine without the sandbox the session stops at startup instead of running commands unsandboxed: no silent downgrade |
| `sandbox.allowUnsandboxedCommands: false` | project | the agent cannot run a command outside the sandbox (the `dangerouslyDisableSandbox` request is ignored): no retry around the control |
| `sandbox.network.allowedDomains: ["registry.npmjs.org", "<git host>", ...]` | project | a command reaches the package registry, the git host of the project (read from `repository` of `package.json`, else from the `origin` remote; add your mirror if you keep one) and the hosts the install scripts of the stack download from (below), and nothing else: no exfiltration by `curl`, no package from an unknown host |
| `sandbox.filesystem.allowWrite`: the caches the install of the stack writes | project | a command writes the project, the temporary directory and these caches only: `~/.npm` with npm, the store and the cache of pnpm, `~/.cache/prisma` with Prisma (below) |
| `sandbox.credentials.files`: `~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.azure` denied | project | a command cannot read the keys of the developer: a prompt injection cannot send them |
| `sandbox.credentials.envVars`: `GITHUB_TOKEN`, `GH_TOKEN`, `GITLAB_TOKEN`, `NPM_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_CLIENT_SECRET` denied | project | the variables are unset before each sandboxed command: a token in the shell of the developer is not in the shell of the agent |
| `permissions.deny: Read(./.env)`, `Read(./.env.local)`, `Read(./.env.*.local)`, `Read(./.env.production)`, `Read(./.env.development)`, `Read(./.env.test)` | project, written without the profile too | the secrets of the project stay out of the context of the agent: the sandbox covers shell commands only, not the Read tool, so a permission rule holds this one |
| `allowManagedPermissionRulesOnly: true` | managed settings | the permission rules of the organisation are the only ones: a project or a user file cannot widen them |
| `permissions.disableBypassPermissionsMode: "disable"` | managed | the mode that skips every permission prompt is refused: no session runs without the gates |
| `allowManagedHooksOnly: true` | managed | only the hooks of the organisation run; copy the hooks of the profile there, or a project file cannot keep them. A project cannot drop the production gate |
| `strictKnownMarketplaces: [{ "source": "github", "repo": "gbourgeat/ddd-ts-kit" }]` | managed | plugins come from the marketplaces the organisation names (the kit's, or your mirror of it): no unreviewed skill |
| `requiredMinimumVersion: "<version>"` | managed | a Claude Code older than the version named does not start: every session has the controls of that version |
| `hooks.PreToolUse`: `production-gate.mjs` on `Bash` | project, `.claude/hooks/` | a command that names the production environment with a release action does not run without a named approval: the release authorisation of the change process, held at the moment the command would run |
| `hooks.PreToolUse`: `change-reference.mjs` on `Edit\|Write` | project, `.claude/hooks/` | an edit of a migration or of the containers is confirmed by a person with a change reference in mind, recorded as the `Change:` trailer of the commit: the change ticket of the change process, on what reaches production otherwise than through the code |

The managed settings live outside the repository (`managed-settings.json`, deployed by the
platform team): `init` prints them as a block to paste, with the version left for the team to
set. Pair the profile with level 1 for the load of the machine.

The two hooks are small Node scripts `init` writes once under `.claude/hooks/` (no `jq`, nothing
to install), registered under `hooks.PreToolUse` of `.claude/settings.json`, owned by the team
from then on, and reported by `doctor` when a file or a registration is missing. Each explains
itself to the agent:

- `production-gate.mjs` runs before every `Bash` command. A command that names the production
  environment of the project (the words of `PRODUCTION_ENVIRONMENTS` at the top of the file,
  `production` by default, read between any separators: `deploy-production` and `deploy_production`
  name it as `deploy:production` does, `non-production` and `pre-production` do not) together with a release action (`RELEASE_ACTIONS`: `deploy`,
  `migrate`, `rollback`) is blocked, exit code 2, with the reason the agent reads: the command
  runs only once a person approved the release, after the release checklist of the team, by
  setting `RELEASE_APPROVAL="<approver> <change id>"` in the environment of the session; the
  hook then lets it through and says who approved what. The agent is told not to set the
  variable itself. The lists are edited in the file, or extended for one session by the
  variables `PRODUCTION_GATE_ENVIRONMENTS` and `PRODUCTION_GATE_ACTIONS` (comma-separated).
  Every other command passes untouched.
- `change-reference.mjs` runs before every `Edit` and `Write`. A file under `migrations/` or
  `prisma/migrations/`, under `docker/`, the `Dockerfile` or `docker-compose.yml` makes the hook
  answer `permissionDecision: "ask"`: the person confirms the edit with a change reference in
  mind (the id of the change ticket or of the story), and the session records it as the trailer
  `Change: <id>` of the commit that holds the file (`git commit -m "<message>" -m "Change: <id>"`,
  [Commit discipline](commit-discipline.md#messages-conventional-commits)). It asks, it does
  not block, and it stays silent for any other file. The trailer is read by people in the
  history, and by `npx ddd-ts-kit story-check <code>`, which lists each commit of a story that
  changes one of these files without it, and blocks on it under the regulated profile; the
  paths the hook watches and those `story-check` reads are the same list, kept aligned in the kit.

The input and the exit codes of a hook follow the
[hooks reference](https://code.claude.com/docs/en/hooks) of Claude Code, read on 2026-10-23:
the JSON of the tool call on the standard input (`tool_name`, `tool_input.command` for `Bash`,
`tool_input.file_path` for `Edit` and `Write`, `cwd`), exit code 2 to block with the standard
error as the reason, exit code 0 with a `hookSpecificOutput` of `permissionDecision` `ask` to
prompt the person. Both hooks are registered in `.claude/settings.json`, which Claude Code alone
reads: Codex and Copilot run neither, and what they hold stays a rule of the team there.

The key names and shapes above were verified on 2026-10-23, and the filesystem lists and the
admin-required sandbox on 2026-10-27, against the Claude Code documentation: [settings](https://code.claude.com/docs/en/settings),
[sandboxing](https://code.claude.com/docs/en/sandboxing),
[permissions](https://code.claude.com/docs/en/permissions) and
[managed settings](https://code.claude.com/docs/en/managed-settings). What was not verified:
the value shape of `requiredMinimumVersion`, which the managed settings page names without an
example (a version string is what `init` leaves a placeholder for), and the scope of
`disableBypassPermissionsMode`, which the settings reference lists as settable from any file but
which only holds in managed settings, the strictest value winning.

**Codex and Copilot.** The profile is written for Claude Code. Codex has its own sandbox,
configured outside the repository (`sandbox_mode` and `approval_policy` of its `config.toml`:
`workspace-write` keeps the network off unless its `network_access` says otherwise), which is
the equivalent of `sandbox.enabled` and of the network block without a per-domain list; the
credential denials, the managed hooks, the marketplaces and the minimum version have no
equivalent the kit knows, and these names were not re-verified for this page. The Copilot cloud
agent runs in a GitHub-hosted environment whose network allow-list is set in the repository
settings of GitHub, not in a file of the project; `.github/copilot/settings.json` has no sandbox
key, so the profile writes nothing for Copilot. The two hooks of the profile run in Claude Code
alone, as said above.

#### The allow-list and the trust of the workspace

The `permissions.allow` rules of `.claude/settings.json` (the allow-list `init` writes, and the
one the regulated profile reviews) apply only in a workspace trusted on the machine that runs the
session. A headless run (`claude -p`, a fresh clone in CI, a scripted agent) never shows the trust
dialog; in a workspace nobody accepted it in, Claude Code ignores those entries and prints on
stderr `Ignoring N permissions.allow entries from .claude/settings.json: this workspace has not
been trusted`. What was checked, with Claude Code 2.1.311 and a project file holding one `allow`
and one `deny` rule: the `allow` rule was not applied (the command was refused), the `deny` rule
was. The Claude Code documentation adds that `ask` rules are not affected either, since they only
restrict, and that hooks, the `env` block and the `.mcp.json` servers are not gated by trust in a
`-p` run (the hooks of the profile still run). The session then works only through what
`--allowedTools` or the permission mode grants, which can hide the gap: a run that passes
`--allowedTools` does not show that the project's allow-list works.

To trust a workspace for headless runs, open it once in Claude Code and accept the dialog, or
set `projects["<repository root>"].hasTrustDialogAccepted` to `true` in `~/.claude.json` of the
account that runs the session (the platform team manages that account in CI). The trust is a
state of that user file, not of the repository, so a team cannot commit it. The documentation
keys the trust on the git repository root, and says a git worktree uses the main checkout's root:
a new worktree path is then not a workspace of its own. That last point was not probed here, nor
was the effect of the managed settings on the allow rules of a project; with
`allowManagedPermissionRulesOnly: true` the rules of the organisation are the only ones in any
case. `ddd-ts-kit doctor` does not report the trust: it would have to open `~/.claude.json`, which
also holds account data, and a kit command does not read that file.

#### The generated contracts under the sandbox

The sandbox of Claude Code turns a permission rule on a file into a rule of the sandbox: a `Read`
deny rule into a path no shell command reads, an `Edit` deny rule into a path no shell command
writes, an `Edit` allow rule into a path they write
([settings reference](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem),
read on 2026-10-27). An `ask` rule stays a rule of the file tools. So `init` writes no `Edit` deny
rule on a file a command of the kit writes: the contracts (`openapi/**`,
`docs/integration/asyncapi.*`, `docs/integration/event-catalog.md`) and the lock of an acceptance
(`test/acceptance/*.acceptance.lock.json`) are `ask` rules, and the guard of the plugin refuses an
edit of one by the `Write` or `Edit` tool outright. `npm run docs:generate`, a merge of a branch
that regenerated them and `ddd-ts-kit acceptance <story> --lock` write them inside the sandbox.

Earlier versions denied them: in a sandboxed session `docs:generate` then stopped on `EROFS` at the
first contract. `init` run again takes the four rules out of `permissions.deny`, asks for them
instead, and says so in its notes. An `allowWrite` entry does not lift a deny rule on the same path
(seen on Linux with Claude Code 2.1.311), so moving the rules is the fix, not adding paths.

#### Installing the stack under the sandbox

The install of a stack writes outside the project and downloads from hosts other than the
registry. The regulated profile opens what the stack `init` chose needs, and nothing more:

| Stack | `filesystem.allowWrite` | `network.allowedDomains` | Why |
|---|---|---|---|
| npm | `~/.npm` | the registry | the cache of npm |
| pnpm | `~/.local/share/pnpm/store`, `~/.cache/pnpm`, `~/Library/pnpm/store`, `~/Library/Caches/pnpm` | the registry | the store and the cache of pnpm, on Linux then on macOS: the sandbox skips a path the machine does not have |
| `--orm prisma` | `~/.cache/prisma` | `binaries.prisma.sh` | the install of `@prisma/engines` downloads the engines into that cache, and `prisma generate` touches them there |
| `--broker kafka` | nothing | `github.com`, `release-assets.githubusercontent.com` | `@confluentinc/kafka-javascript` downloads its prebuilt binary from the releases of its repository, which redirect to the host of release assets |

With these entries, a sandboxed `npm install` of the Kafka client, `prisma generate` and
`prisma migrate diff` succeed (seen on Linux with Claude Code 2.1.311). Three cases are not covered
by the project file, and `init` says them in its notes:

- **The first install.** A path of `allowWrite` that does not exist when the session starts stays
  read-only for the whole session: the sandbox makes no new directory writable. The owner runs the
  first `npm install` (or `pnpm install`) from a terminal outside the agent, right after `init`: it
  creates the caches, and it runs the install scripts of the stack under the owner's eyes. The
  agent resumes at `npm run verify`, as the `bootstrap` skill says, and its installs afterwards,
  `npm ci` in a worktree included, run in the sandbox.
  Those scripts run because `init` allows them by name: `@prisma/engines` and
  `@confluentinc/kafka-javascript`, in `allowScripts` of `package.json` under npm, in `allowBuilds`
  of `pnpm-workspace.yaml` under pnpm, which runs no other. A name allows every later version, and
  the profile asks for each version to be read: after the first install the owner pins them,
  `npm install-scripts approve @prisma/engines @confluentinc/kafka-javascript` turning each name
  into the installed version (under pnpm, `'<package>@<version>': true` in `allowBuilds`, the
  version `pnpm why <package>` gives). A bump of one of them, a Dependabot pull request for one,
  then needs the same step once its new script was read: until then `npx ddd-ts-kit doctor`
  reports it and `doctor --strict` fails, while npm 11.19 still runs the new script with a warning
  and pnpm skips it (both checked with npm 11.19.1 and pnpm 12.11.2).
- **No prebuilt binary of the Kafka client.** Where none fits the machine (an unusual platform or
  Node version), the client builds librdkafka from sources: a compiler, `~/.cache/node-gyp`,
  `nodejs.org`, `zlib.net` and `curl.se`. The profile opens none of them, since the build could
  not succeed without all of them: that install runs outside the agent every time.
- **A sandbox the managed settings require.** When the managed settings, or the `--settings` of a
  session, set `sandbox.allowUnsandboxedCommands` to `false` (or the managed settings set
  `sandbox.network.allowManagedDomainsOnly`), Claude Code ignores `filesystem.allowWrite` and
  `network.allowedDomains` of `.claude/settings.json`
  ([sandboxing](https://code.claude.com/docs/en/sandboxing#repository-settings-under-an-admin-required-sandbox)):
  the platform team copies the entries of the project into the managed settings.

A writable cache is shared with the other projects of the developer. npm and pnpm check what they
take from it against the integrity of the lockfile; Prisma checks an engine against a checksum kept
beside it, in the same cache, so a session could leave an engine there that another project then
runs outside the sandbox. A team that will not take this removes `~/.cache/prisma` from the list,
and the owner runs `prisma generate` outside the agent. `init` run again adds an entry the stack
needs to a list the project already holds, and keeps the project's own; `doctor` names an entry
the list lacks.

#### The database under the sandbox

A sandboxed command cannot open a TCP connection to the database of the project, whatever the
`sandbox.network` block holds. Probed on Claude Code 2.1.311 on Linux, with PostgreSQL listening on
`127.0.0.1` and a plain `net.connect` in the session: `allowedDomains` with `localhost` and
`127.0.0.1`, with or without a port, `allowLocalBinding: true` and `allowAllUnixSockets: true` all
end in `ECONNREFUSED`. The sandbox gives a command its own network, whose only way out is the proxy
of the domain list, and the proxy relays HTTP and HTTPS, not the protocol of a database;
`allowLocalBinding` and `allowUnixSockets` are settings of macOS and are ignored on Linux. No
setting of the sandbox reaches a local database, so the profile does not write one, and the only
setting that would widen anything (`allowAllUnixSockets`) reaches a socket file, not a port, and
opens every socket of the machine, the container engine's included.

So in a session under the regulated profile the agent writes the schema and the code, and the owner
(or the pipeline) runs what needs the database, from a terminal outside the sandbox:

- `npm run db:migrate` under every ORM (which fails on the connection);
- the migrations are not on that list: `npm run db:generate <name>` needs no server when
  `DATABASE_URL` is unset. Under Prisma and TypeORM the kit then starts PostgreSQL in process
  (PGlite served over the wire protocol, the engine `openTestDatabase()` runs the tests on),
  replays the migrations already written, diffs them against the schema and writes the new
  migration, with the append-only statements of the audit trail. Drizzle generates from its
  snapshots and Knex files are written by hand. A sandboxed agent generates its own migrations; on
  TypeORM it builds first (`npm run build && npm run db:generate migrations/<name>`);
- the integration and end-to-end specs that name a `DATABASE_URL`; the specs on the in-memory fakes
  and the end-to-end specs without `DATABASE_URL` (an in-process database) run in the session.

When `DATABASE_URL` is set and its server does not answer (unset it to generate on the in-process database), `prisma-generate` and `typeorm-generate`
stop before the tool, exit 3 (the code of what a session cannot do here) and say it, instead of a
raw connection error; the command is then handed to the owner as it stands.

#### The empty files the sandbox leaves

Where the sandbox of Claude Code mounts a path it protects and the path does not exist, it leaves
an empty file or a `/dev/null` device in the project: `.mcp.json`, `.claude/launch.json`,
`.claude/scheduled_tasks.json`, `.claude/settings.local.json`, `loop.md` and dotfiles such as
`.bashrc`. They are not part of the project, and an empty JSON file is not valid JSON. The
configurations `init` writes walk past them: `biome.json` skips `.claude` and `.mcp.json` and
reads the git ignore file (so that a pnpm store written into the project, `.pnpm-store/`, which
`.gitignore` lists with pnpm, is not walked), and `knip.json` sets `"mcp": false`, so that Knip
does not load `.mcp.json`. A project written before this keeps its old files: add these lines to
them, or run `init --force`.

The sandbox may also leave a read-only `.git/config.lock`. Delete it from a terminal outside the
sandbox before `git config` or `git branch -d`, which refuse to run while it exists.

#### Creating the project under the sandbox

The sandbox of Claude Code keeps the agent from writing `.claude/settings.json`, `.claude/hooks/`
and `.git/hooks`: where `init` writes the agent settings and the hooks of the regulated profile,
and where `npm run hooks:install` installs the git hooks. `init` writes every other file and lists
these under `unwritable` (and in `skipped`) of its report, a dry run included, exits 3, and ends
with a note that gives the command to finish: the same `init`, run from a terminal outside the sandbox, which
writes the missing files and keeps the ones written. The `bootstrap` skill hands both to the owner
from the start: the agent runs the dry run and shows the command, the owner runs `init`, the agent
resumes at `npm install`, and the owner runs `npm run hooks:install` before the first commit.
Under the regulated profile the owner also runs that first `npm install`, right after `init`, and
the agent resumes at `npm run verify`
([Installing the stack under the sandbox](#installing-the-stack-under-the-sandbox)).

### 3. NVIDIA OpenShell

[OpenShell](https://github.com/NVIDIA/OpenShell) is the open source runtime (Apache 2.0) NVIDIA
released in March 2026 to run autonomous agents in sandboxes. It runs Claude Code, Codex,
Copilot CLI, OpenCode and others. What it adds to the two levels above:

- **the whole agent is inside**, its hooks, tools and MCP servers included, as an unprivileged
  process held by Landlock and seccomp;
- **the network is closed by default**: a policy allows each host, for each binary, with the
  methods and paths it may use;
- **credentials stay out**: a gateway adds them only to requests bound for an allowed endpoint,
  so a prompt injection cannot read your API key from the environment;
- **CPU and memory are capped** per sandbox on Docker and Podman; an audit log keeps every
  allowed and denied decision.

**Requirements.** Linux 6.2 or later with Landlock (ABI 3) and seccomp, Docker 28 or Podman 5;
macOS on Apple Silicon with Docker Desktop; Windows through WSL 2 is experimental. Launch fails
closed when Landlock is missing.

**Windows** is supported through WSL 2 only (there the platform is `linux`). Outside it, `affected --run`,
`verify-slice`, `worker-scope`, `story-scope`, `worktree` (unless `--no-install` or `--dry-run`) and
`merge-trunk` refuse to run, at their entry and before any process starts: the package manager is
reached through `cmd.exe`, which passes the arguments of a script unescaped (`affected --run "test & calc"`
would run `calc`). The refusal exits with code 2.

**Limits to know**, as of 0.1.4:

- no folder of the host is mounted: files are copied in (`openshell sandbox upload`) and out
  (`openshell sandbox download`), or the sandbox clones the repository and pushes a branch. Your
  editor does not see the files while the agent works;
- `--upload` cannot be combined with the command of `sandbox create`: create, upload, then
  `sandbox exec`;
- the documented sign-in of Claude Code is `ANTHROPIC_API_KEY`, which the CLI turns into a
  provider; a subscription sign-in is not documented;
- the VM driver accepts `--cpu` and `--memory` without applying them: use Docker or Podman;
- the project is young (0.1.x): pin a stable release and read its upgrade notes.

**A ddd-ts-kit project in OpenShell.** An image with the Node version of the project, git and
the agent; the default policy of the sandbox, plus the npm registry and the git host; the cap
of the machine. The commands below are the ones the OpenShell documentation gives; check them
against your version.

```dockerfile
# Dockerfile of the sandbox: Node of the project, git, the agent
FROM node:24-bookworm
RUN npm install --global @anthropic-ai/claude-code
```

```sh
export ANTHROPIC_API_KEY=...   # becomes a provider: the sandbox never sees the key
openshell sandbox create --name shop --from <your-registry>/ddd-agent:node24 \
  --cpu 4 --memory 8Gi --env VITEST_MAX_WORKERS=2

# npm reaches the registry through node, git reaches its host through git-remote-https
openshell policy update shop --rule-name npm_registry --binary /usr/local/bin/node \
  --add-endpoint registry.npmjs.org:443:read-only:rest:enforce --wait
openshell policy update shop --rule-name git_host --binary /usr/lib/git-core/git-remote-https \
  --add-endpoint github.com:443:read-write:rest:enforce --wait

openshell sandbox exec -n shop -- git clone https://github.com/<you>/shop shop
openshell sandbox exec -n shop -- sh -c 'cd shop && npm ci && npx --no -- lefthook install'
openshell sandbox connect shop   # then `cd shop && claude`
```

A policy can also be written once as a file (`--policy ./policy.yaml` at creation, or baked
into the image as `/etc/openshell/policy.yaml`): its sections are `filesystem_policy`,
`landlock` (`compatibility: hard_requirement` refuses to start without it), `process` and
`network_policies`, described in the
[policy schema](https://docs.nvidia.com/openshell/latest/how-it-works/policies/schema).
`openshell policy get shop --full` prints the one in force, a good start for that file.

`VITEST_MAX_WORKERS` matters inside a container: Node counts the cores of the host, not the
`--cpu` of the sandbox, so half of them can be more workers than the cap runs well. Install
the plugin in the agent of the sandbox as on the host ([The plugin for coding
agents](coding-agents.md)); the session then works as on the host: a story or a worker in its
worktree of `.worktrees/`, the guard, the hooks and the gate unchanged. A push needs a credential for the git host: attach a
provider when your version has one for it, or keep the sandbox without it and bring the
commits out (`git bundle create`, then `openshell sandbox download`) to push from the host.
For [parallel work](parallel-work.md), one sandbox per worker gives each its own cap.

`openshell logs shop --source sandbox --level warn` shows the requests the policy denied:
allow a host there only when the work needs it.

## Which one

- The machine stalls or restarts, the code is yours: level 1, the pre-push hook and the
  runner config of the kit.
- An agent works unattended, or on code or prompts you did not write (an issue, a dependency,
  a pull request from outside): OpenShell, with its `--cpu` and `--memory`.
- Between the two: level 2 with level 1; in a regulated organisation, level 2 as
  `init --agent-profile regulated` writes it, with its managed settings.

## Sources

- [NVIDIA OpenShell documentation](https://docs.nvidia.com/openshell/): support matrix,
  sandboxes, policies and their schema, read on 2026-10-19 (version 0.1.4).
- [NVIDIA OpenShell on GitHub](https://github.com/NVIDIA/OpenShell).
- [Claude Code: configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing),
  [settings](https://code.claude.com/docs/en/settings),
  [permissions](https://code.claude.com/docs/en/permissions),
  [managed settings](https://code.claude.com/docs/en/managed-settings),
  [hooks](https://code.claude.com/docs/en/hooks), read on 2026-10-23; the sandboxing page and the
  [settings reference](https://code.claude.com/docs/en/settings-reference) again on 2026-10-27, for
  the filesystem lists and the admin-required sandbox.
- Anthropic, *AI-Native SDLC Playbook*
  ([PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)):
  the worked example of a regulated organisation the profile follows.

## See also

- [Parallel work](parallel-work.md): workers, worktrees and waves.
- [The plugin for coding agents](coding-agents.md): what the guard checks, and what it does not.
- [Quality baseline](../tools/quality-baseline.md): what runs before a commit, before a push and
  in the pipeline.
