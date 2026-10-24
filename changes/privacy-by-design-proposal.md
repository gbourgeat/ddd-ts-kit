**A proposal page says what privacy by design asks of the kit beyond event sourcing, and the
pull requests that build it.** `docs/proposals/privacy-by-design.md` verifies what the kit
erases today (the personal values of stored events, by crypto-shredding, with a dated audit
entry) and what nothing of the kit erases, exports, retains or inventories: the aggregates kept
as rows on the four ORMs, the read models, the copies a person leaves in the contexts that
consumed its events, the masks of the audit trail. It designs one declaration of the personal
fields, read by ports with an adapter per ORM, by generators, by a generated register and by
`privacy/*` rules, nothing of it mandatory for a project without personal data; cuts the work
into pull requests in merge order, the example first; and says what a tool can never guarantee,
with the wording that follows for the README. The glossary of the translations gains the terms
of the page. Nothing of the code changes.
