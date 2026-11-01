**English** · [Français](0007-the-guard-names-the-readers-of-vs-code.fr.md)

# ADR-0007: the guard names the readers of VS Code

## Decision

VS Code runs the hooks of the plugin without a matcher, so the write hooks of the guard run on every tool of its chat. The guard names the tools that only read, by the names the chat gives its hooks in copilot-chat 0.72, read in the manifest of that extension and in the names its code gives each tool: `read_file`, `view_image`, `list_dir`, `file_search`, `grep_search`, `semantic_search`, `search_workspace_symbols`, `get_errors`, `get_changed_files`, `read_project_structure`, `copilot_getNotebookSummary`, `read_notebook_cell_output`, `test_search`, `fetch_webpage`, `github_repo`, `github_text_search`, `get_vscode_api`, `search_subagent`, `explore_subagent`, `resolve_memory_file_uri`, and `memory` when its command is `view`. A call of one of them writes nothing, whatever field names a file: `path`, `filePath` or `file_path`. Any other name is read as before: a `file_path` or a `path` is a write, and `filePath` is one for the tools that write.

## Why

A reader named a writer is a false refusal. `list_dir` names its folder in `path`, the field the guard reads for a write, so a worker that lists a folder outside its context was refused. The other way round, a writer named a reader is a write the guard never judges.

A list of writers fails open. A tool that writes, added in a later release of the chat, would not be on it, and its writes would pass unjudged until the list caught up. A list of readers fails closed. A reader added later is judged as a write, which costs a false refusal, said in the reason and seen at once, until it is named. The guard is a guide, but between a refusal that can be seen and a write that cannot, it takes the refusal.

`memory` both reads and writes, so its command decides: `view` reads, and `create`, `str_replace`, `insert`, `delete` and `rename` stay judged as before.

## What it costs

The list follows the chat. A reader it lacks still gets the false refusal this record removes, and a release that renames a tool brings the refusal back until the list is updated. A tool named here that starts to write in a later release would write unjudged. That is the risk the list of writers takes for every new tool; here it takes it only for a tool that changes its kind, which the changelog of the chat would say.

## What would reverse it

A host that applies the matchers of the plugin, as Claude Code does, so that the write hooks run on the tools that write and on nothing else. Or a field in the input of a hook that says whether the tool writes.
