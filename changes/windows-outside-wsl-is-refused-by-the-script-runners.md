**`affected --run`, `slice`, `worker` and `merge` refuse to run on Windows outside WSL 2.** They started the scripts of the project through a shell on `win32`, and `cmd.exe` passes the arguments unescaped: `affected --run "test & calc"` would have run `calc`. They now stop with exit code 2 before any process starts, and say to run under WSL 2 (where the platform is `linux` and nothing changes). `docs/guides/agent-sandbox.md` states what Windows supports.

To move: on Windows, run the CLI inside WSL 2.
