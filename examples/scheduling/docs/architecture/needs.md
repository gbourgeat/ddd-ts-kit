# Statement of needs

Stated by the product owner of a network of professional practices (medical, paramedical, legal:
any practice that receives people by appointment), 2026-10-10. This page is the only input of the
method: everything under `docs/architecture/` and `src/` derives from it.

## Who we are

We run a platform on which independent practices publish their calendars and take appointments.
A practice employs practitioners, who receive patients, and assistants, who run the front desk.
A practice manager administers one practice. We, the platform, open the practices and answer the
support requests of everyone.

## What we need

1. **Publish availability.** A practitioner has one or several calendars in a practice. A calendar
   has weekly opening hours, with several ranges a day (morning and afternoon), exceptions (a
   closed day, an exceptional opening) and time off. Each appointment type has a duration and
   starts on a grid (every 15 minutes, every 30 minutes); a buffer may be kept free between two
   appointments. A practice lives in one time zone and the hours are the hours on its wall,
   whatever the season.
2. **Book.** A patient books a free slot for themselves, not earlier than a minimum notice and not
   further than a maximum horizon. Two people never hold the same time on one calendar, even when
   they click at the same instant. A patient holds at most a few future appointments with the same
   practitioner.
3. **Follow an appointment.** A booking that needs it is confirmed by the patient, or expires. An
   appointment is rescheduled, cancelled (we keep who cancelled and why), completed, or marked as
   a no-show. Moving an appointment never leaves the patient without a slot or with two.
4. **Wait for a full day.** When a day is full a patient joins its waitlist. When a slot is freed,
   the first waiter it suits gets it held for a short time, then the next one.
5. **Delegate.** A practitioner lets an assistant manage their calendars: book, move, cancel. Only
   those calendars. Changing the opening hours is delegated explicitly or not at all. A delegation
   may end at a date, and can be withdrawn at any time.
6. **Keep each practice to itself.** A practice manager manages every calendar of their practice
   and sees nothing of another practice. A patient sees and cancels only their own appointments,
   and cancels freely until 24 hours before; later, the practice decides. A practitioner cancels
   any appointment of their calendars at any time, and says why. In a shared view of a calendar a
   patient sees that a slot is taken, never by whom.
7. **Tell people.** Patients receive a confirmation, a reminder 24 hours before, and a notice when
   an appointment is moved or cancelled. A reminder is sent once.
8. **Measure.** A practice follows the occupancy of its calendars, its cancellations and its
   no-shows, per day.
9. **Support and accountability.** Our support staff may look at what a user sees, on their
   behalf, and change nothing; every such look is recorded. We must be able to say who did what,
   who was refused what, and when.

## Constraints

- People sign in through the identity provider we host (Keycloak). The platform knows a person by
  the identity it issues.
- One deployable application today (a modular monolith), with a separate process for the work
  done by time; any part may have to be extracted later.
- PostgreSQL holds the data. One Redis protocol server (Dragonfly) serves the cache, the rate
  limiter, the lock of the scheduled work and the event streams.
- Everything is traced, logged and reported with one identifier per action.

## Out of scope

Payment, video consultation, medical records, patient self-registration flows of the identity
provider, calendars shared by several practitioners, recurring appointments.
