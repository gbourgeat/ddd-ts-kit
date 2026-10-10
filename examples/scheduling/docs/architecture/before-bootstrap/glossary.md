# Ubiquitous language (before the bootstrap)

One section per context. The bootstrap turns each row into a `--term` of `generate context` and
deletes this file: the terms then live in each `CONTEXT.md` and nowhere else.

## identity

| Term | Meaning | Not to be confused with |
|---|---|---|
| Person | Someone known to the platform by the identity the identity provider issued, with a display name and a contact address | scheduling: Patient, the role a person plays in one appointment |
| Register | To make a person known to the platform at their first sign-in | |
| Practice | A place where practitioners receive people, in one time zone, administered by its managers | |
| Open | To create a practice with its first manager | scheduling: opening hours |
| Member | A person with a role in a practice: manager, practitioner or assistant | |
| Membership | The fact that a person is a member of a practice with a role | |
| Add | To make a person a member of a practice | |
| Remove | To end a membership; the delegations of that member end with it | |
| Manager | A member who administers one practice | |
| Practitioner | A member who receives people | scheduling: the owner of calendars |
| Assistant | A member who runs the front desk and may receive delegations | |
| Delegation | The permission a practitioner gives an assistant of the same practice to manage their calendars, until an optional end, with or without the right to change availability | |
| Grant | To give a delegation | |
| Revoke | To withdraw a delegation before its end | |
| Expire | To end a delegation because its end date passed | scheduling: an unconfirmed appointment expires |
| Desk | The post of one practitioner in one practice: what a delegation is given on | |
| Directory | The answer to "who is this person", given to other contexts | |

## scheduling

| Term | Meaning | Not to be confused with |
|---|---|---|
| Calendar | The agenda a practitioner opens to booking in a practice, with its availability and its booking rules | analytics: a line that is measured |
| Create | To open a new calendar for a practitioner | |
| Practitioner | The owner of calendars, known from identity | identity: a member with a role |
| Patient | The person an appointment is for | identity: Person |
| Availability | When a calendar can be booked: opening hours, exceptions and time off together | |
| Opening hours | The weekly ranges, in the wall-clock time of the practice, during which a calendar takes appointments | |
| Range | A span of one day between two wall-clock times | Slot, which is a span between two instants |
| Exception | A day whose hours replace the weekly ones: closed, or opened on other ranges | Time off |
| Time off | A period during which nothing can be booked, whatever the hours | Exception |
| Appointment type | A kind of appointment a calendar offers, with its duration, its grid, its buffer and whether it needs a confirmation | |
| Duration | How long an appointment of a type lasts | |
| Grid | The step, in minutes from midnight, on which appointments of a type start | |
| Buffer | The time kept free after an appointment, part of what it holds | |
| Booking window | The earliest and the latest a slot can be booked: a minimum notice and a maximum horizon | |
| Notice | The minimum time between booking and start | notification: a message |
| Horizon | The maximum time between booking and start | |
| Limit | The number of future appointments a patient may hold with one practitioner | |
| Slot | A span of time on a calendar that an appointment holds or could hold | Range |
| Scheduler | The rule keeper that says whether a slot can be taken on a calendar, given what the calendar already holds | |
| Appointment | The hold of a slot on a calendar for a patient, from booking to its end | |
| Book | To take a free slot for a patient | Request |
| Request | To take a slot that the patient must still confirm | |
| Confirm | To say that a requested appointment will be honoured | |
| Reschedule | To move an appointment to another slot of the same calendar, in one step | |
| Cancel | To end an appointment before it takes place, saying who and why | Expire |
| Cancellation | Who cancelled (the patient or the practice) and the reason given | analytics: a count |
| Reason | The words given for a cancellation | |
| Expire | To end a requested appointment that was not confirmed in time | Cancel |
| Complete | To say that an appointment took place | |
| No show | The patient did not come | |
| Mark | To record a no-show after the start | |
| Waitlist | The people waiting for a freed slot on one calendar and one day, in arrival order | |
| Waiter | A patient on a waitlist, for an appointment type | |
| Join | To enter a waitlist | |
| Leave | To quit a waitlist | |
| Offer | A freed slot held for one waiter until a deadline | |
| Hold | The time during which an offer waits for its waiter | |
| Agenda | The appointments of a calendar or of a practice over a day, as the people who run it see them | |
| Day | A calendar date in the time zone of the practice | |
| Time zone | The zone whose wall clock the practice lives by | |
| Free | Not held by any appointment, time off or closed hour | |
| Busy | Held, without saying by whom | |

## notification

| Term | Meaning | Not to be confused with |
|---|---|---|
| Notification | A message sent to a person about one fact of one appointment | scheduling: Notice |
| Send | To hand a notification to the mail provider | |
| Recipient | The person a notification is for | scheduling: Patient |
| Contact | The address at which a recipient is reached | |
| Confirmation | The notification that an appointment is booked or confirmed | |
| Reminder | The notification due 24 hours before the start of an appointment, once per appointment and start | |
| Plan | To schedule the reminder of an appointment | |
| Due | Whose time to be sent has come | |
| Withdraw | To drop a planned reminder because its appointment ended or moved | scheduling: Cancel |
| Mailer | The mail provider, seen from here | |

## analytics

| Term | Meaning | Not to be confused with |
|---|---|---|
| Occupancy | The time held by appointments on a calendar over a day, with their count | |
| Outcome | How an appointment stands for measurement: held, completed, no-show, cancelled by the patient, cancelled by the practice, expired | scheduling: the appointment itself |
| Cancellation | A count of appointments cancelled on a day, by party | scheduling: who and why |
| No show | A count of appointments whose patient did not come | |
| Calendar | A line whose occupancy is measured, in a practice | scheduling: the agenda |
| Day | A calendar date in the time zone of the practice | |
| Verify | To recompute the figures of recent days from the outcomes and repair a difference | |
