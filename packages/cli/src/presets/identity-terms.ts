import type { GlossaryRow } from '../generate/parse-terms.js';

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
];
