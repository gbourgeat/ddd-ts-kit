# The glossary of the identity preset

The rows `generate context identity --preset identity` writes into the section
`## Ubiquitous language` of `src/contexts/identity/CONTEXT.md`, word for word. Before the
bootstrap they are the draft of the section `identity` of `docs/architecture/glossary.md`: copy
them, fill `Not to be confused with` where a neighbouring context uses the same word, and add
only the business terms beyond them. A spec of the CLI keeps this page equal to the preset.

| Term | Meaning |
|---|---|
| Account | A person as the application knows them, under the subject the identity provider gives them; provisioned at their first sign-in, never holding a password |
| Subject | The stable identifier the identity provider gives a person: the id of their account |
| Provision | Create the account of a person at their first sign-in, from what their token says, and refresh it after |
| Deactivate | Stop an account from acting: its person signs in no more, its history stays |
| Organisation | A group of accounts that work together, identified by its slug; the tenant of its data when the project has tenants |
| Slug | The identifier of an organisation, chosen when it opens: lower-case letters, digits and hyphens |
| Member | The membership of one account in one organisation, in one role |
| Role | Owner, admin or member: what a member may do in an organisation follows from it |
| Right | One thing a member may do in an organisation: read, invite or manage members, grant delegations |
| Invitation | An organisation asks a person, by email address, to join in a role; answered with its token within a week, or taken back |
| Delegation | A member lends some of the rights of their role to another member, for at most ninety days |
| Display name | How a person is shown to the others: from their token, or as they wrote it |
| Email address | Where a person is reached, always the one their token says: an invitation is matched on it |
| Open | Create an organisation under its slug; the account that opens it is its first owner |
| Join | Become a member of an organisation: by opening it, or by accepting an invitation |
| Change | Give a member another role; only an owner appoints or changes an owner |
| Remove | End a membership; an organisation keeps one owner at least |
| Invite | Issue an invitation to an email address, in a role |
| Issue | Create an invitation and its token, which is sent once and never stored |
| Accept | Answer yes to an invitation sent to oneself, before it expires: one joins in its role |
| Decline | Answer no to an invitation sent to oneself |
| Grant | Lend rights of a role to another member, for a period |
| Revoke | Take back an invitation not answered, or end a delegation before its period |
| Period | When a delegation holds: from its start, included, to its end, excluded |
| Search | Read a page of the members of an organisation, for one of its members |
| Identity provider | The system that authenticates the people (Keycloak): the application follows it, never stores its secrets |
| Owner | The highest role: an owner may do everything in an organisation, appointing or changing another owner included |
| Last owner | The only owner an organisation has left: they are neither removed nor given another role, an organisation keeps one owner at least |
| Above | Higher in the order of roles: an owner is above an admin, an admin above a member |
| Own role | The role of the member who acts: they do not change it themselves, and act on no one above it |
| Oneself | The member who acts, as the other party of their own act: no one delegates to oneself |
| Pending | Said of an invitation issued and not yet accepted, declined, revoked or expired: the only state in which it is answered |
| Expire | For an invitation, to pass its week unanswered: it is accepted or declined no more |
| Withdrawn | Said of a pending invitation whose issuer may no longer invite in its role (removed, deactivated, demoted or no longer lent the right): it lets nobody in |
| Verified | Said of an email address the identity provider confirmed belongs to the person: an account is provisioned with it only then |
| Taken | Said of a slug an organisation holds already: two organisations never share one |
| Active | Said of a delegation granted and not ended yet: neither revoked nor past its period |
| Inverted | Said of a period whose end does not come after its start |
| Long | Said of a delegation whose period lasts more than ninety days: a longer one is a role, not a delegation |
