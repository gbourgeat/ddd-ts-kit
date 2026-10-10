# Context map (draft)

| Downstream | Upstream | Pattern | What crosses | Why this pattern |
|---|---|---|---|---|
| scheduling | identity | customer-supplier | events `identity.practice.member-added`, `identity.practice.member-removed` (a local projection of practitioners, used to create calendars and to label lists); read contract `PersonDirectory` behind a gateway (the display name of a patient on a detail view) | scheduling is the core: what it needs from identity (the time zone of the practice in the membership event, a batch lookup of names) is planned into identity's work |
| notification | scheduling | published-language | events `scheduling.appointment.booked`, `.confirmed`, `.rescheduled`, `.cancelled`, `.expired` | notification reacts; scheduling knows nothing of messages |
| notification | identity | published-language | event `identity.person.registered` (a local projection of contacts) | a contact is needed at send time, even when identity is down |
| analytics | scheduling | conformist | events `scheduling.calendar.created`, `scheduling.appointment.booked`, `.rescheduled`, `.cancelled`, `.completed`, `.marked-no-show`, `.expired`; read contract `AppointmentExport` behind a gateway (the source of a projection rebuild) | analytics measures scheduling's facts in scheduling's terms and has no say in them; a translation layer would only rename |

No cycle: identity is upstream of everything it touches; scheduling is upstream of notification
and analytics; nothing flows back.

## Two ways to read another context, one of each

- **Projection** (scheduling keeps `practitioners` from identity's membership events): the data is
  needed to decide (a calendar is created only for a practitioner of the practice) and to label
  every row of a list; it must be there when identity is not, and a list cannot call per row.
- **Gateway with hydration** (scheduling asks identity for the display name of a patient on the
  detail view of one appointment): one element, read rarely, whose name must be the current one,
  and which scheduling has no reason to store (personal data stays where it is owned).

## Delegations do not cross as data

A delegation is granted in identity and decides rights on calendars of scheduling. It does not
travel as an event that scheduling copies: identity writes the relationship
`desk:<practice>.<practitioner>#delegate@user:<assistant>`, scheduling writes
`calendar:<id>#desk@desk:<practice>.<practitioner>`, and the authorization model joins them
(tuple to userset). The events `identity.delegation.granted` and `.revoked` are still published,
for the audit trail and for future consumers.

## The audit trail

Platform capability, not a context (argued in `contexts.md`): it consumes every integration event
under the consumer name `audit` and records every decision and every command from the buses.
