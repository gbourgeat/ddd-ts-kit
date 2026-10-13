**English** · [Français](contexts.fr.md)

# Bounded contexts

| Context | Classification | Purpose (two sentences, business terms) | Owns (events of the timeline) | Owner |
|---|---|---|---|---|
| identity | supporting | Knows the people, the practices they work in and what a practitioner delegated to an assistant. It says who is who; it never says what happens on a calendar. | 1 to 7 | platform operations |
| scheduling | core | Publishes the availability of calendars and takes appointments on them, from booking to completion. It guarantees that a time on a calendar is held once. | 8 to 23 | practices (product) |
| notification | supporting | Tells people what happened to their appointments and reminds them before the start. It decides nothing about an appointment. | 24, 25 | patient relations |
| analytics | supporting | Measures the occupancy, the cancellations and the no-shows of each calendar, per day. It only reads what the other contexts announce. | 26, 27 | practice managers |

The audit trail (rows 28 and 29) is not a context: see "Rejected cuts".

## Why these boundaries

- identity / scheduling: "practitioner" is a member with a role for identity and the owner of calendars for scheduling; "patient" is any person for identity and the one an appointment is for in scheduling (language). Membership and delegation rules change without a calendar noticing (autonomy).
- scheduling / notification: the policy "whenever Appointment booked, notify the patient" links an event to a command across two owners; a mail provider being down must never refuse a booking (autonomy, and the external system has its own model).
- scheduling / analytics: "cancellation" is an end of an appointment with a party and a reason in scheduling, a number per day in analytics (language); analytics decides nothing and may lag (consistency: eventual is accepted and said).
- scheduling keeps the waitlist: an offer holds a time on a calendar, which must be true at the same instant as the appointments (consistency).
- identity keeps delegations: a delegation is between two members of one practice and ends when one leaves it (consistency with membership); scheduling does not copy it, the authorization model reads it.

## Rejected cuts

- A separate `availability` context next to `booking`: a slot is valid against opening hours, time off and appointments at the same instant; two contexts would need a distributed check. Revisit if availability is one day sold to other products.
- A separate `waitlist` context: its offers hold calendar time; kept in scheduling as its own aggregate.
- An `audit` context: the audit trail records around every use case of every context, with no language of its own and no decision; it is a capability of the platform (`src/platform/audit/`), read through one protected route. It would become a context the day auditors get use cases of their own (legal holds, exports with a workflow).
- An `organization` level above the practice: not in the needs (hot spot); the practice is the unit kept to itself.
- A `reminder` context: a reminder is one kind of notification with a due time; kept in notification.
