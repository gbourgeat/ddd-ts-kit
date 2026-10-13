# Proposal: which contexts deserve a preset

This page weighs which bounded contexts, besides `identity`, the kit should write whole with
`--preset`, and says why the others should not be. None is built: the `identity` preset is the
only one ([Bootstrap with well-designed contexts](../guides/bootstrap-with-well-designed-contexts.md)).

## Status (2026-10-13)

| Context | Verdict | In one line |
|---|---|---|
| Identity | **built** | accounts from the identity provider, organisations, members, invitations, delegations |
| Notification | **next** | the language is stable and every application rewrites it; the example already has one to learn from |
| Files | **later** | generic, but needs an object storage port and adapter the kit does not have |
| Personal data requests | **a guide, not a preset** | it spans every context; a context of its own would hide that |
| Audit | **no** | a capability of the platform (`@ddd-ts-kit/audit`, `--audit on`), not a context |
| Billing, subscriptions | **no** | prices, plans and invoices are where businesses differ |
| Settings, feature flags | **no** | a tool answers it (OpenFeature and a provider); no domain to model |

## What makes a context worth a preset

A preset is worth writing when all of these hold:

1. **Generic.** Classified `generic` in most projects that have it
   ([Domain and subdomains](../concepts/domain-and-subdomains.md)): needed, and no business wins
   with a better one.
2. **One language.** Its terms mean the same thing from one project to the next, so a glossary
   can be written once. Identity passes (account, organisation, member, invitation); "order"
   does not.
3. **Mistakes it prevents.** It holds decisions a team gets wrong early: a password table, a
   tenant id read from the request, a token kept in clear, a notification sent before the
   commit.
4. **Few stack decisions.** What it needs of the stack is already a choice of `init`; a preset
   that needs a new kind of adapter needs that adapter first.
5. **Small enough to own.** A team reads it in an hour and changes it like its own code. A
   preset is written once and never updated in the project by the kit.

## Notification: next

What it would hold: a contact per account (addresses per channel, preferences, quiet hours);
a message requested by an integration event of another context, rendered from a template and
sent after the commit through one port per channel (email, SMS, push) with an in-memory fake;
delivery attempts with their outcome, retries bounded by the resilience policies of the kit;
an opt-out that wins over every request; a search of the messages of a contact.

Why next: criteria 1 to 3 hold in nearly every application, and the example's own
`notification` context already proves the shape on Knex (contacts, a search, consumers of the
events of `scheduling`). What it costs: one email adapter at least (SMTP through a small
client, or a documented recipe for a provider's HTTP API), and templates, which the kit has no
convention for yet; a first version can take templates as code.

## Files: later

What it would hold: an upload accepted only to a presigned URL, a file record with its owner,
type, size and digest, a scan state before a file is served, retention and deletion with the
element it belongs to.

Why later: criterion 4 fails today. The kit has no object storage port nor an S3 compatible
adapter, and a preset would have to bring both, with their contract suite and a local double
(MinIO) in the compose file. Build the port and adapter in a package first; the preset then
follows.

## Personal data requests: a guide

Export and erasure requests touch every context that keeps personal data, each in its own
tables and words. A context that answered them alone would have to read everyone's tables, or
every context would publish its data to it: both break the boundaries the kit enforces. The
better shape is a convention: each context declares the data it keeps on a person and answers
an integration event `person.erasure-requested` itself; the audit trail records the outcome. A
guide, with a generator for the handler, fits; a preset does not.

## Audit, billing, settings: no

- **Audit** is already written by the platform around every use case, with its own tables and
  its search ([Audit trail](../concepts/audit-trail.md)). A context would duplicate it.
- **Billing and subscriptions** fail criterion 2: plans, prorating, taxes and invoices differ by
  business and by country, and the payment provider decides much of the model. The kit can help
  with a gateway to a provider (`generate gateway`), not with a model.
- **Settings and feature flags** fail criterion 1 differently: there is nothing to model, and
  a tool (OpenFeature with a provider) does it better than a context.

## Not decided

- Whether a preset should be able to target an existing context to add a part of it (invitations
  only, for example). Today a preset writes a whole context, and a file that is already there is
  kept.
- Whether presets should live outside the CLI package, so that a team can publish its own. The
  `Preset` interface of `packages/cli/src/presets/preset.ts` would allow it; the templates and
  their variants by stack are the cost.
