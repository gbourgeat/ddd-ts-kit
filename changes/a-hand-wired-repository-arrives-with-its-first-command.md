**In a context wired by hand (`--di manual`, `--di nest`), `generate repository` no longer creates
the repository in the module file: the first `generate command --aggregate` that needs it does, and
the next one finds it there.** Until now the module file of a context with a repository and no
command yet held a constant nothing read, and its import, which the lint of the project refused
(`no-unused-vars`). `declarations/port-adapter-wired` agrees: an adapter whose port no class needs
yet (no file outside the infrastructure and the tests names it, but the one that declares it) is not
reported, since nothing misses it at run time.

To move: nothing. A module file written by an earlier version keeps its constant; the next command
on the same aggregate finds it and adds nothing.
