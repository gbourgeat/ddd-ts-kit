**The guard reads at most 16 MiB of a file it compares, and copies no more to hold it.** Past that size, the note
before a command of a worker hashes the size and time of a changed file instead of its content, and keeps no copy
of it. A file past the bound that was already changed before the command, and that changes during it, has nothing
to be put back to: it is said to the worker, who leaves it out of its commits and names it in its report, and it is
not held. The same goes for a file the guard cannot read.
