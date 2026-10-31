**The guard reads the editor tools of VS Code.** `create_file`, `replace_string_in_file`,
`multi_replace_string_in_file`, `insert_edit_into_file` and `edit_notebook_file` are judged before the write and
checked after it, the scope of a worker included: `filePath`, `oldString`, `newString`, `code`, and `replacements`,
one write per file they name. A change of the `scripts` of `package.json` is read from the text these calls leave,
and `code`, which the host merges, is asked. VS Code keeps no matcher, so the write hooks also run on its readers:
`filePath` is read for the tools that write, and a `read_file` stays a read.
