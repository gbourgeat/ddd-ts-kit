**The GitHub pipeline `init` writes runs on the newest patch of its Node release line.** `setup-node`
used the Node the runner image already holds, which lags behind a security release of Node: on
2026-10-22 the runners still held 24.21.0, two days after 24.22.1 fixed CVE-2026-111497 (remote
code execution in the Brotli decoder) and nine other vulnerabilities. The setup action now asks for
`check-latest: true`, and each run installs the newest 22.x or 24.x. The GitLab pipeline already
followed the image tag, which carries the newest patch, and the image builds of both pipelines
read the `node` base image from the registry at each run.

An image already built keeps the Node it was built with, and `docker build` reuses the base image
the machine already holds: the guide of the commands now ships with `docker build --pull .`.

To move: in `.github/actions/setup/action.yml`, add `check-latest: true` under the `node-version`
of the `actions/setup-node` step. Rebuild with `docker build --pull .` (or
`docker compose build --pull`) every image built before 2026-10-21 that runs somewhere, and update
the Node of each machine to 22.23.4, 24.22.1 or 26.12.1.
