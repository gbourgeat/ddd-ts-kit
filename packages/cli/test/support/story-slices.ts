/** The slices of a story of billing, the way the plan writes them: what `generate acceptance` reads. */
export const STORY_SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US1.01 | billing | skeleton | Invoice | \`generate aggregate billing Invoice\` | | conductor | done |
| US1.02 | billing | slice | Issue invoice | \`generate command billing IssueInvoice --aggregate Invoice --permission invoice.issue\` | US1.01 | billing | todo |
`;
