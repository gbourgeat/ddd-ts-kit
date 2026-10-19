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
| workers of the test runner | each run | outside a pipeline (no `CI` variable) Vitest and Jest take half of the cores (`maxWorkers: '50%'` in the generated config); `VITEST_MAX_WORKERS=2`, or `--maxWorkers=2` for Jest, sets the number |
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
- Between the two: level 2 with level 1.

## Sources

- [NVIDIA OpenShell documentation](https://docs.nvidia.com/openshell/): support matrix,
  sandboxes, policies and their schema, read on 2026-10-19 (version 0.1.4).
- [NVIDIA OpenShell on GitHub](https://github.com/NVIDIA/OpenShell).
- [Claude Code: configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing).

## See also

- [Parallel work](parallel-work.md): workers, worktrees and waves.
- [The plugin for coding agents](coding-agents.md): what the guard checks, and what it does not.
- [Quality baseline](../tools/quality-baseline.md): what runs before a commit, before a push and
  in the pipeline.
