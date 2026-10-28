**`--force` never destroys work git does not hold, and no write of the CLI leaves the project.**

Every file `init` and `generate` write stays inside the project: a file that is a symbolic link,
or a path that leads out of the project through one (a linked `docs/adr`, a `.claude/settings.json`
linked to the settings of a home directory), refuses the command with exit code 2 and the path
named, before anything is written. `init` refuses a home directory and the root of the file
system: run it in the directory of the project.

The directories of the config (`sourceRoot`, `contextsDir`, `sharedKernelDir`, `platformDir`)
are read with `.` and `..` resolved, and one that is absolute or leads above the root once
resolved (`"contextsDir": "src/../../escaped"`) stops every command that writes with exit code 2;
`check` reports it as `config/valid`.

To move: replace a symbolic link a command of the kit writes through by the file or the folder
itself; write each directory of the config inside the project.
