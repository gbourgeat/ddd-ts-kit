import type { GlossaryRow } from '../generate/parse-terms';

/** The ubiquitous language of the identity preset, written into the glossary of its CONTEXT.md. */
export const IDENTITY_TERMS: readonly GlossaryRow[] = [
  {
    term: 'Account',
    meaning:
      'A person as the application knows them, under the subject the identity provider gives them; provisioned at their first sign-in, never holding a password',
  },
  { term: 'Subject', meaning: 'The stable identifier the identity provider gives a person: the id of their account' },
  {
    term: 'Provision',
    meaning: 'Create the account of a person at their first sign-in, from what their token says, and refresh it after',
  },
  { term: 'Deactivate', meaning: 'Stop an account from acting: its person signs in no more, its history stays' },
  {
    term: 'Organisation',
    meaning:
      'A group of accounts that work together, identified by its slug; the tenant of its data when the project has tenants',
  },
  {
    term: 'Slug',
    meaning: 'The identifier of an organisation, chosen when it opens: lower-case letters, digits and hyphens',
  },
  { term: 'Member', meaning: 'The membership of one account in one organisation, in one role' },
  { term: 'Role', meaning: 'Owner, admin or member: what a member may do in an organisation follows from it' },
  {
    term: 'Right',
    meaning: 'One thing a member may do in an organisation: read, invite or manage members, grant delegations',
  },
  {
    term: 'Invitation',
    meaning:
      'An organisation asks a person, by email address, to join in a role; answered with its token within a week, or taken back',
  },
  {
    term: 'Delegation',
    meaning: 'A member lends some of the rights of their role to another member, for at most ninety days',
  },
  { term: 'Display name', meaning: 'How a person is shown to the others: from their token, or as they wrote it' },
  {
    term: 'Email address',
    meaning: 'Where a person is reached, always the one their token says: an invitation is matched on it',
  },
  { term: 'Open', meaning: 'Create an organisation under its slug; the account that opens it is its first owner' },
  { term: 'Join', meaning: 'Become a member of an organisation: by opening it, or by accepting an invitation' },
  { term: 'Change', meaning: 'Give a member another role; only an owner appoints or changes an owner' },
  { term: 'Remove', meaning: 'End a membership; an organisation keeps one owner at least' },
  { term: 'Invite', meaning: 'Issue an invitation to an email address, in a role' },
  { term: 'Issue', meaning: 'Create an invitation and its token, which is sent once and never stored' },
  { term: 'Accept', meaning: 'Answer yes to an invitation sent to oneself, before it expires: one joins in its role' },
  { term: 'Decline', meaning: 'Answer no to an invitation sent to oneself' },
  { term: 'Grant', meaning: 'Lend rights of a role to another member, for a period' },
  { term: 'Revoke', meaning: 'Take back an invitation not answered, or end a delegation before its period' },
  { term: 'Period', meaning: 'When a delegation holds: from its start, included, to its end, excluded' },
  { term: 'Search', meaning: 'Read a page of the members of an organisation, for one of its members' },
  {
    term: 'Identity provider',
    meaning:
      'The system that authenticates the people (Keycloak): the application follows it, never stores its secrets',
  },
  {
    term: 'Owner',
    meaning:
      'The highest role: an owner may do everything in an organisation, appointing or changing another owner included',
  },
  {
    term: 'Last owner',
    meaning:
      'The only owner an organisation has left: they are neither removed nor given another role, an organisation keeps one owner at least',
  },
  { term: 'Above', meaning: 'Higher in the order of roles: an owner is above an admin, an admin above a member' },
  {
    term: 'Own role',
    meaning: 'The role of the member who acts: they do not change it themselves, and act on no one above it',
  },
  { term: 'Oneself', meaning: 'The member who acts, as the other party of their own act: no one delegates to oneself' },
  {
    term: 'Pending',
    meaning:
      'Said of an invitation issued and not yet accepted, declined, revoked or expired: the only state in which it is answered',
  },
  { term: 'Expire', meaning: 'For an invitation, to pass its week unanswered: it is accepted or declined no more' },
  {
    term: 'Withdrawn',
    meaning:
      'Said of a pending invitation whose issuer may no longer invite in its role (removed, deactivated, demoted or no longer lent the right): it lets nobody in',
  },
  {
    term: 'Verified',
    meaning:
      'Said of an email address the identity provider confirmed belongs to the person: an account is provisioned with it only then',
  },
  { term: 'Taken', meaning: 'Said of a slug an organisation holds already: two organisations never share one' },
  { term: 'Active', meaning: 'Said of a delegation granted and not ended yet: neither revoked nor past its period' },
  { term: 'Inverted', meaning: 'Said of a period whose end does not come after its start' },
  {
    term: 'Long',
    meaning: 'Said of a delegation whose period lasts more than ninety days: a longer one is a role, not a delegation',
  },
];
