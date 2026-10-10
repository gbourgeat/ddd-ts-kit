# Domain discovery

Light event storming in writing, from `needs.md`. The words are those of the practices.

## Timeline

| # | Actor | Command | Domain event | Then (policy) | Needs to see (read model) |
|---|---|---|---|---|---|
| 1 | Person (first sign-in) | Register person | Person registered | | |
| 2 | Platform admin | Open practice | Practice opened | whenever Practice opened, the first manager is a member | |
| 3 | Practice manager | Add member (practitioner, assistant, manager) | Member added | whenever a practitioner was added, scheduling knows them | Members of the practice |
| 4 | Practice manager | Remove member | Member removed | whenever Member removed, their delegations end | Members of the practice |
| 5 | Practitioner, practice manager | Grant delegation (to an assistant, until a date, with or without availability) | Delegation granted | | Assistants of the practice |
| 6 | Practitioner, practice manager | Revoke delegation | Delegation revoked | | Delegations given |
| 7 | Time (every 5 minutes) | Expire delegations | Delegation expired | | |
| 8 | Practitioner, practice manager | Create calendar | Calendar created | whenever Calendar created, analytics follows it | Practitioners of the practice |
| 9 | Practitioner, delegate with availability, practice manager | Set opening hours | Opening hours set | | The calendar |
| 10 | same | Add exception (closed day, exceptional opening) | Exception added | | The calendar |
| 11 | same | Add time off | Time off added | | Appointments of the period |
| 12 | same | Define appointment type (duration, grid, buffer) | Appointment type defined | | |
| 13 | Patient, delegate, practitioner, practice manager | Book appointment | Appointment booked (or Appointment requested when the type asks for a confirmation) | whenever booked, notify the patient; analytics counts it | Free slots of a day |
| 14 | Patient | Confirm appointment | Appointment confirmed | whenever confirmed, notify the patient | My appointments |
| 15 | Time (every 5 minutes) | Expire unconfirmed appointments | Appointment expired | whenever expired, offer the slot to the waitlist | |
| 16 | Patient, delegate, practitioner, practice manager | Reschedule appointment | Appointment rescheduled | whenever rescheduled, notify; offer the old slot to the waitlist | Free slots, the appointment |
| 17 | Patient (until 24 h before), delegate, practitioner (with a reason), practice manager | Cancel appointment | Appointment cancelled | whenever cancelled, notify; offer the slot to the waitlist; analytics counts it | My appointments, the day of a calendar |
| 18 | Practitioner, delegate, practice manager | Complete appointment | Appointment completed | analytics counts it | The day of a calendar |
| 19 | Practitioner, delegate, practice manager | Mark no-show | Appointment marked no-show | analytics counts it | The day of a calendar |
| 20 | Patient | Join waitlist (calendar, day, appointment type) | Waitlist joined | | A full day |
| 21 | System (policy of 15, 16, 17) | Offer freed slot | Slot offered (to the first waiter it suits, held until a deadline) | whenever Slot offered, notify the waiter | Waiters of the day, in order |
| 22 | Patient (the waiter) | Accept offer | Offer accepted, then Appointment booked | | The offer |
| 23 | Time (every minute) | Expire offers | Offer expired | whenever Offer expired, offer the slot to the next waiter | |
| 24 | Time (every 15 minutes) | Send due reminders | Reminder sent (once per appointment and start) | | Appointments starting in 24 h |
| 25 | System (policy of 13, 14, 16, 17, 21) | Send notification | Notification sent, or Notification failed | | Contact of the person |
| 26 | Time (every night) | Verify occupancy | Occupancy verified | | |
| 27 | Practice manager, practitioner | (reads) | | | Occupancy, cancellations, no-shows per calendar and day |
| 28 | Support | (reads on behalf of a user) | | every look is recorded | What the user sees |
| 29 | Platform admin | (reads) | | | Who did what, who was refused what |

## External systems

| System | Used for | Direction | What happens when it is down |
|---|---|---|---|
| Keycloak | sign-in, the identity and the role of a person | inbound (tokens) | nobody signs in; nothing is lost |
| Mail provider | confirmations, reminders, notices | outbound | the notification is retried, then set aside and reported; the appointment is not affected |
| Error tracker (Sentry protocol) | unexpected failures | outbound | failures are still logged |
| Trace backend (OTLP) | traces | outbound | nothing else is affected |

## Rules heard

- Opening hours are wall-clock hours of the practice's time zone; a day of 23 or 25 hours keeps them.
- A slot starts on the grid of its appointment type, lasts its duration, and lies inside one opening range of that day.
- An exception replaces the weekly hours of its day: closed, or other ranges.
- A time off closes everything it covers, exceptional openings included.
- A buffer after an appointment is part of the time it holds on the calendar.
- An appointment never overlaps another active appointment of the same calendar, nor a time off, nor leaves the opening hours. Two bookings of one slot at the same instant: exactly one wins.
- Booking window: not before the minimum notice of the calendar, not after its maximum horizon.
- A patient holds at most N future active appointments with the same practitioner (N belongs to the calendar; 3 by default).
- An appointment type that needs a confirmation gives a requested appointment, which holds its slot and expires when not confirmed in time.
- Rescheduling moves the hold: never two slots, never none.
- A cancellation records who (the patient or the practice) and the reason; the practice always gives one.
- A patient cancels or reschedules until 24 hours before the start.
- Completed and no-show are said after the start only. A cancelled, expired, completed or no-show appointment does not change any more.
- The waitlist of a calendar and a day is served in arrival order; an offer is held 30 minutes for one waiter, then goes to the next; a waiter is served once.
- One reminder per appointment and start: a rescheduled appointment is reminded again for its new start.
- A delegation covers the calendars of one practitioner in one practice, for one assistant of that practice; it ends at its date, on revocation, or when either leaves the practice.
- A delegate changes availability only when the delegation says so.
- A practice manager manages every calendar of their practice and nothing of another.
- In a shared view, a patient sees a taken slot as busy, without the name.
- Support reads on behalf of a user, never writes, and every look is recorded.

## Words with several meanings

| Word | Meaning for whom |
|---|---|
| Calendar | for a practitioner: the agenda they open to booking; for analytics: a line whose occupancy is measured |
| Patient | for scheduling: the person an appointment is for; for identity: a person like any other; for notification: a recipient |
| Practitioner | for identity: a member of a practice with that role; for scheduling: the owner of calendars |
| Slot | for a patient: a time they can book; for the waitlist: a time that was freed and is offered |
| Cancellation | for scheduling: an end of an appointment with a party and a reason; for analytics: a number per day |
| Member | for identity: a person with a role in a practice; scheduling only knows practitioners |

## Hot spots

- Does an organization group several practices? Not in the needs: the practice is the unit that is kept to itself. Product owner.
- May a patient reschedule inside the 24 hours? Taken as no, like cancelling. Product owner.
- Is the time off refused when appointments already exist in it? Taken as: refused, the practice cancels or moves them first. Practitioners.
- Does a no-show count against the patient's limit or block booking? Not asked. Product owner.
- Which channel for notifications beyond mail? Mail only for now. Product owner.
