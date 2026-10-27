**The privacy register no longer says "until erased" for a retention read from configuration.**
`personalFields` accepts `configuredRetention: 'RETENTION_PERIODS'`, the key of the configuration
that gives the period when the project reads it at run time and purges by its own job. The generated
register and the `CONTEXT.md` write ``configured by `RETENTION_PERIODS` `` in the Kept column. The key
is read from the source text, never the value; the kit's own purge still runs only from a literal
`retention`, and the two together are refused.
