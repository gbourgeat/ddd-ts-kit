**The policies a story was designed under are named in its record.** At the design phase, the
story skill lists the policy skills it loaded (those of the plugin and the project's own under
`.claude/skills/`) on the `Policies in force:` line of `## Origin`, and writes in the section of a
row of the design review a line `Policies: <skill>: <what it imposed here>` when a policy changed
the design; two policies that contradict each other become a decision for the owner. The
`architecture-reviewer` agent reads those lines as part of its design review. Nothing new runs:
the skills already load; the record now says which ones did.
