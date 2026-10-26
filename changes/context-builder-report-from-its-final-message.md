**A `context-builder` agent returns its report as its final message, and a `SubagentStop` hook of the plugin writes it to `.ddd-ts-kit/report.md` of its worktree.**

Claude Code refuses a sub-agent the write of a report file ("Subagents should return findings as text, not write report files."), so the report that `worker-scope --resume` and the guard read was never there. The agent is no longer asked to write it; the guard takes its last message (from the hook input, else from the transcript the input names) and writes the file in the worktree of the worker, failing open. The briefing of `worker-scope` and its resume message say the same. The `parallel-work` and `story` skills tell the conductor to write the file from the worker's final message when it is missing after the worker returns.

The guard no longer asks an agent that stops to rewrite a report older than its last commit; it still keeps it going once when a slice that passed `verify-slice` is left uncommitted.
