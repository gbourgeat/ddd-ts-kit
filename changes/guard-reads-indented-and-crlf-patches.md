**The guard reads a patch whose file headers are indented or whose lines end in CRLF.** `*** Add File:`,
`*** Update File:` and `*** Delete File:` are read with an indent, and every line of a patch with either line ending,
as the patch tool of the host parses them. What that parser refuses stays unread: a lower case header, a wider
marker, an indented `+` or `-` line.
