# Identity

## Purpose

Knows the people, the practices they work in and what a practitioner delegated to an assistant. It says who is who; it never says what happens on a calendar.

## Classification

supporting

Needed and specific (delegations between members of a practice), but not what practices choose the platform for: a plain model is enough.

## Ubiquitous language

| Term | Meaning | Not to be confused with |
|---|---|---|
| Person | Someone known to the platform by the identity the identity provider issued, with a display name and a contact address | scheduling: Patient, the role a person plays in one appointment |
| Register | To make a person known to the platform at their first sign-in |  |
| Practice | A place where practitioners receive people, in one time zone, administered by its managers |  |
| Open | To create a practice with its first manager | scheduling: opening hours |
| Member | A person with a role in a practice: manager, practitioner or assistant |  |
| Membership | The fact that a person is a member of a practice with a role |  |
| Add | To make a person a member of a practice |  |
| Remove | To end a membership; the delegations of that member end with it |  |
| Manager | A member who administers one practice |  |
| Practitioner | A member who receives people | scheduling: the owner of calendars |
| Assistant | A member who runs the front desk and may receive delegations |  |
| Delegation | The permission a practitioner gives an assistant of the same practice to manage their calendars, until an optional end, with or without the right to change availability |  |
| Grant | To give a delegation |  |
| Revoke | To withdraw a delegation before its end |  |
| Expire | To end a delegation because its end date passed | scheduling: an unconfirmed appointment expires |
| Desk | The post of one practitioner in one practice: what a delegation is given on |  |
| Directory | The answer to "who is this person", given to other contexts |  |
| Email | The contact address of a person, where the platform writes to them |  |
| Display name | The name a person is shown by to the others |  |
| Time zone | The IANA zone whose wall-clock time a practice lives in |  |
| Role | What a member is in a practice: manager, practitioner or assistant |  |

## Aggregates

<!-- ddd-ts-kit:aggregates -->
- `Delegation`
- `Person`
- `Practice`
<!-- /ddd-ts-kit:aggregates -->

## Published events

<!-- ddd-ts-kit:events -->
- `identity.delegation.granted` (version 1)
- `identity.delegation.revoked` (version 1)
- `identity.person.registered` (version 1)
- `identity.practice.member-added` (version 1)
- `identity.practice.member-removed` (version 1)
- `identity.practice.opened` (version 1)
<!-- /ddd-ts-kit:events -->

## Permissions

<!-- ddd-ts-kit:permissions -->
- `identity:delegation.expire`
- `identity:person.register`
- `identity:practice.open`
- `identity:member.add`
- `identity:member.remove`
- `identity:delegation.grant`
- `identity:delegation.revoke`
<!-- /ddd-ts-kit:permissions -->

## Scheduled jobs

<!-- ddd-ts-kit:jobs -->
| Job | Schedule | Command |
|---|---|---|
| `identity.expire-delegations` | `every 5m` | `ExpireDelegations` |
<!-- /ddd-ts-kit:jobs -->

## Relationships

<!-- ddd-ts-kit:relationships -->
- Upstream of `scheduling` (customer-supplier).
- Upstream of `notification` (published-language).
<!-- /ddd-ts-kit:relationships -->

## Domain events and what follows them

An effect of a domain event exists only if the state change that recorded it is committed. Every
handler of this context runs in the default phase, at the end of the unit of work of the command
and before its commit, and has transactional effects only:

- The publishers append to the outbox, in the transaction of the command.
- The handlers of `application/event-handlers/` write or delete what the platform reads to
  decide a right, through `IdentityRelationships`. Its adapter, `TupleIdentityRelationships`,
  writes tuples in `authorization.relation_tuples`, a table of the same database (ADR-0001), in
  the transaction of the command: a relationship commits or rolls back with the fact it
  follows, and a check made later in the same unit of work reads it.
  `PracticeMemberRemovedEventHandler` also ends the delegations of the member through
  `DelegationRepository`; their events wait behind the one being handled.

The choice for `IdentityRelationships`, made when the dispatch moved to the end of the unit of
work. The adapter was generated under `infrastructure/external/` as `RemoteIdentityRelationships`
with the kind `external`, which reads as a call to a remote store before the commit, and the
rule `domain-events/transactional-before-commit` refuses that. Two answers exist for a store
that is really remote: the `after-commit` phase, at most once, which would lose a relationship
on a crash, a right never granted or, worse, never withdrawn; or an integration event consumed
by this context, at least once, which makes a right lag behind the fact it follows. Neither is
needed here, and both are weaker than what the code already does: the store is a table of the
transaction. So the declaration was corrected instead of the timing: the adapter is a
persistence adapter, in `infrastructure/persistence/`, declared with `@Repository`, and the
handlers stay before the commit. `test/integration/relationships-commit-with-the-fact.spec.ts`
proves on PostgreSQL that the tuple is committed with the person, and is not there when the
unit of work fails, before or after the handler wrote it.

If the tuples ever move to a remote service, the adapter goes back to `infrastructure/external/`,
the rule refuses the five handlers again, and the answer is then the integration event: each
fact is already published (`identity.person.registered`, `identity.practice.member-added`,
`identity.practice.member-removed`, `identity.delegation.granted`, `identity.delegation.revoked`),
writes and deletions of a tuple are idempotent, and a relationship must not be lost.

## Reference

<!-- ddd-ts-kit:reference -->
Generated from the code by `ddd-ts-kit docs`; the same facts as data: `ddd-ts-kit describe identity --json`. The fields of each schema are in the generated contracts: [OpenAPI](../../../openapi/openapi.json), [event catalog](../../../docs/integration/event-catalog.md).

**Dependencies**: upstreams: none; downstreams: `scheduling` (customer-supplier), `notification` (published-language).

### Use cases

| Use case | Kind | Permission |
|---|---|---|
| `AddMember` | command | `member.add` |
| `ExpireDelegations` | command | `delegation.expire` |
| `GrantDelegation` | command | `delegation.grant` |
| `OpenPractice` | command | `practice.open` |
| `RegisterPerson` | command | `person.register` |
| `RemoveMember` | command | `member.remove` |
| `RevokeDelegation` | command | `delegation.revoke` |

### Routes

| Method | Path | Operation | Use case | Permission | Request | Responses | Errors |
|---|---|---|---|---|---|---|---|
| PUT | `/people/me` | `registerPerson` | `RegisterPerson` | `person.register` | body: `RegisterPersonBody` | 200: `RegisterPersonAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_DISPLAY_NAME`, `INVALID_EMAIL` |
| POST | `/practices` | `openPractice` | `OpenPractice` | `practice.open` | body: `OpenPracticeBody` | 201: `OpenPracticeAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `UNKNOWN_TIME_ZONE`, `PERSON_NOT_REGISTERED` |
| POST | `/practices/:practiceId/desks/:practitionerId/delegations` | `grantDelegation` | `GrantDelegation` | `delegation.grant` | params: `GrantDelegationParams`, body: `GrantDelegationBody` | 201: `GrantDelegationAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `PRACTICE_NOT_FOUND`, `NOT_A_PRACTITIONER`, `NOT_AN_ASSISTANT`, `DELEGATION_ENDS_IN_THE_PAST`, `DELEGATION_ALREADY_ACTIVE` |
| DELETE | `/practices/:practiceId/desks/:practitionerId/delegations/:delegationId` | `revokeDelegation` | `RevokeDelegation` | `delegation.revoke` | params: `RevokeDelegationParams` | 200: `RevokeDelegationAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `DELEGATION_NOT_FOUND`, `DELEGATION_NOT_ACTIVE` |
| POST | `/practices/:practiceId/members` | `addMember` | `AddMember` | `member.add` | params: `AddMemberParams`, body: `AddMemberBody` | 201: `AddMemberAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `PRACTICE_NOT_FOUND`, `PERSON_NOT_REGISTERED`, `UNKNOWN_ROLE`, `ALREADY_MEMBER` |
| DELETE | `/practices/:practiceId/members/:personId` | `removeMember` | `RemoveMember` | `member.remove` | params: `RemoveMemberParams` | 200: `RemoveMemberAccepted` | `UNAUTHORIZED`, `FORBIDDEN`, `PRACTICE_NOT_FOUND`, `NOT_A_MEMBER`, `LAST_MANAGER` |

### Publishers

| Event | Versions | Publisher |
|---|---|---|
| `identity.delegation.granted` | 1 | `DelegationGrantedPublisher` |
| `identity.delegation.revoked` | 1 | `DelegationRevokedPublisher` |
| `identity.person.registered` | 1 | `PersonRegisteredPublisher` |
| `identity.practice.member-added` | 1 | `PracticeMemberAddedPublisher` |
| `identity.practice.member-removed` | 1 | `PracticeMemberRemovedPublisher` |
| `identity.practice.opened` | 1 | `PracticeOpenedPublisher` |

### Ports

| Port | Kind | Adapters |
|---|---|---|
| `DelegationRepository` | repository | `KnexDelegationRepository` |
| `IdentityRelationships` | repository | `TupleIdentityRelationships` |
| `PersonRepository` | repository | `KnexPersonRepository` |
| `PracticeRepository` | repository | `KnexPracticeRepository` |
<!-- /ddd-ts-kit:reference -->
