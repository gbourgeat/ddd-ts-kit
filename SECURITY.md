**English** · [Français](SECURITY.fr.md)

# Security policy

## Supported versions

The packages are not published to a registry yet: the `main` branch is the only supported
version, and a fix lands there.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

Report it privately through
[GitHub private vulnerability reporting](https://github.com/gbourgeat/ddd-ts-kit/security/advisories/new).
Say what is affected (a package, the CLI, a generated template, the plugin hook, a pipeline
asset), how to reproduce it and what an attacker gains.

You can expect an acknowledgement within seven days. A confirmed vulnerability is fixed on
`main`, then disclosed in a GitHub security advisory that credits the reporter unless they ask
otherwise.

## Scope

In scope: the code of this repository, including what `ddd-ts-kit init` and
`ddd-ts-kit generate` write into a consuming project, since a flaw in a template is repeated
in every project generated from it.

Out of scope: a vulnerability of a third-party dependency with no impact through this
repository (report it upstream), and the application under `examples/`, which runs with
development credentials and is not meant to be deployed as is.
