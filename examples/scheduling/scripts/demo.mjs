// The scripted scenario of the real run: real tokens from the local Keycloak, the API and the
// worker started from `dist/`, PostgreSQL, Dragonfly, Jaeger and GlitchTip from docker compose.
// It prints a Markdown transcript (docs/demo-transcript.md is one run of it) and exits 1 at the
// first step that does not answer as designed. Local development credentials only.
//
//   node --env-file=.env scripts/demo.mjs
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { setTimeout as pause } from 'node:timers/promises';
import { reportsOf } from './demo/glitchtip.mjs';
import { impersonate, signIn } from './demo/keycloak.mjs';
import { say, section, show } from './demo/transcript.mjs';

const api = 'http://127.0.0.1:' + (process.env.PORT ?? '54300');
const jaeger = 'http://127.0.0.1:' + (process.env.JAEGER_UI_PORT ?? '54686');
const USERS = ['demo-admin', 'demo-manager', 'demo-manager-b', 'demo-practitioner', 'demo-assistant', 'demo-patient', 'demo-patient-2', 'demo-support'];
const EVERY_DAY = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const HALF_HOUR = 30 * 60_000;

const people = Object.fromEntries(await Promise.all(USERS.map(async (name) => [name, await signIn(name)])));

await main();

async function main() {
  const practice = await openPractices();
  const calendar = await openCalendar(practice);
  const nextWeek = slotAt(7 * 24 * 60);

  await delegate(practice, calendar, nextWeek);

  const booking = await bookTwice(calendar, nextWeek);

  await isolation(practice, booking);
  await lateCancellation(calendar);
  await consumers(practice);
  await support(booking);
  await audit();
  await trace(booking.traceId);
  await incident();
  say('\nEvery step answered as designed.');
}

async function openPractices() {
  section('1. People register, the platform admin opens two practices');

  for (const name of USERS) await call(name, 'PUT', '/people/me', { displayName: people[name].displayName, email: name + '@example.test' }, 200);

  const first = await call('demo-admin', 'POST', '/practices', { name: 'Riverside practice', timeZone: 'Europe/Paris', managerId: people['demo-manager'].id }, 201);

  await call('demo-admin', 'POST', '/practices', { name: 'Hillside practice', timeZone: 'Europe/Lisbon', managerId: people['demo-manager-b'].id }, 201);
  await call('demo-patient', 'POST', '/practices', { name: 'Mine', timeZone: 'Europe/Paris', managerId: people['demo-patient'].id }, 403);
  await call('demo-manager', 'POST', `/practices/${first.id}/members`, { personId: people['demo-practitioner'].id, role: 'practitioner' }, 201);
  await call('demo-manager', 'POST', `/practices/${first.id}/members`, { personId: people['demo-assistant'].id, role: 'assistant' }, 201);

  return first.id;
}

async function openCalendar(practiceId) {
  section('2. The practitioner opens a calendar with its availability');

  const created = await eventually('scheduling knows the practitioner from the membership event', () =>
    quietly('demo-practitioner', 'POST', '/calendars', { practiceId, practitionerId: people['demo-practitioner'].id }),
  );
  const calendarId = created.body.id;

  show('demo-practitioner', 'POST', '/calendars', created);
  // Open around the clock, so that the run does not depend on the hour it is played at.
  await call('demo-practitioner', 'PUT', `/calendars/${calendarId}/opening-hours`, { ranges: EVERY_DAY.map((weekday) => ({ weekday, start: '00:00', end: '23:30' })) }, 200);

  const type = await call('demo-practitioner', 'POST', `/calendars/${calendarId}/appointment-types`, { name: 'Consultation', duration: 30, grid: 30, buffer: 0, needsConfirmation: false }, 201);

  return { id: calendarId, typeId: type.id };
}

async function delegate(practiceId, calendar, startsAt) {
  section('3. Delegation: the assistant manages the calendars delegated to them, and only what was delegated');

  const desk = `/practices/${practiceId}/desks/${people['demo-practitioner'].id}/delegations`;
  const forSomeone = { calendarId: calendar.id, appointmentTypeId: calendar.typeId, patientId: people['demo-patient-2'].id, startsAt: later(startsAt, 2) };

  await call('demo-assistant', 'POST', '/appointments', forSomeone, 403);
  await call('demo-practitioner', 'POST', desk, { assistantId: people['demo-assistant'].id, availabilityIncluded: false }, 201);
  await call('demo-assistant', 'POST', '/appointments', forSomeone, 201);
  await call('demo-assistant', 'PUT', `/calendars/${calendar.id}/opening-hours`, { ranges: [] }, 403);
}

async function bookTwice(calendar, startsAt) {
  section('4. A patient books for themselves; the same slot is refused to the next one');

  const traceId = randomBytes(16).toString('hex');
  const request = { calendarId: calendar.id, appointmentTypeId: calendar.typeId, startsAt: startsAt.toISOString() };
  const booked = await call('demo-patient', 'POST', '/appointments', request, 201, { traceparent: `00-${traceId}-${randomBytes(8).toString('hex')}-01` });

  await call('demo-patient-2', 'POST', '/appointments', request, 409);
  await call('demo-patient', 'GET', '/appointments?filter[status]=booked&sort=-startsAt', undefined, 200);

  return { id: booked.id, traceId, calendarId: calendar.id, day: startsAt.toISOString().slice(0, 10) };
}

async function isolation(practiceId, booking) {
  section('5. Each practice to itself, each patient to themselves');
  await call('demo-manager-b', 'GET', `/practices/${practiceId}/agenda`, undefined, 403);
  await call('demo-manager-b', 'GET', `/practices/${practiceId}/occupancy`, undefined, 403);
  await call('demo-manager-b', 'GET', '/appointments', undefined, 200);
  await call('demo-patient-2', 'GET', `/appointments/${booking.id}`, undefined, 403);
  await call('demo-patient-2', 'GET', `/calendars/${booking.calendarId}/days/${booking.day}`, undefined, 200);
  await call('demo-manager', 'GET', `/practices/${practiceId}/agenda`, undefined, 200);
}

async function lateCancellation(calendar) {
  section('6. Less than 24 hours before: the patient may not cancel any more, the practitioner may, with a reason');

  const soon = { calendarId: calendar.id, appointmentTypeId: calendar.typeId, patientId: people['demo-patient'].id, startsAt: slotAt(3 * 60).toISOString() };
  const booked = await call('demo-practitioner', 'POST', '/appointments', soon, 201);

  await call('demo-patient', 'POST', `/appointments/${booked.id}/cancellation`, {}, 403);
  await call('demo-practitioner', 'POST', `/appointments/${booked.id}/cancellation`, {}, 422);
  await call('demo-practitioner', 'POST', `/appointments/${booked.id}/cancellation`, { reason: 'The practitioner is called away.' }, 201);
}

async function consumers(practiceId) {
  section('7. The other contexts followed: notifications sent, figures measured from the outcomes');

  const sent = await eventually('notification consumed the bookings', () => quietly('demo-patient', 'GET', '/notifications'), (answer) => answer.body.items.length >= 3);
  const figures = await eventually('analytics recorded the outcomes of the appointments', () => quietly('demo-manager', 'GET', `/practices/${practiceId}/occupancy`), (answer) => answer.body.items.some((line) => line.cancelledByPractice === 1));

  show('demo-patient', 'GET', '/notifications', sent);
  show('demo-manager', 'GET', `/practices/${practiceId}/occupancy`, figures);
}

async function support(booking) {
  section('8. Support looks on behalf of the patient, and cannot write');
  people['support-as-patient'] = await impersonate('demo-support', people['demo-patient'].id);
  say(`\`demo-support\` impersonates \`demo-patient\` in Keycloak: the token is the patient's, with \`impersonator_id\` = ${people['support-as-patient'].impersonatedBy}.\n`);
  await call('support-as-patient', 'GET', `/appointments/${booking.id}`, undefined, 200);
  await call('support-as-patient', 'POST', `/appointments/${booking.id}/cancellation`, {}, 403);
}

async function audit() {
  section('9. The audit trail: who was allowed, who was refused, who looked on whose behalf');
  await call('demo-manager', 'GET', '/audit/entries', undefined, 403);

  const denied = await call('demo-admin', 'GET', `/audit/entries?outcome=denied&actorId=${people['demo-manager-b'].id}&limit=3`, undefined, 200);
  const looked = await call('demo-admin', 'GET', `/audit/entries?actorId=${people['demo-patient'].id}&limit=100`, undefined, 200);
  const onBehalf = looked.items.filter((entry) => JSON.stringify(entry).includes(people['demo-support'].id));

  must(denied.items.length > 0, 'a denied decision is recorded');
  must(onBehalf.length > 0, 'entries carry the impersonator');
  say(`Entries of the patient that carry the impersonator ${people['demo-support'].id}: ${onBehalf.length}, for example:\n\n\`\`\`json\n${JSON.stringify(onBehalf[0], null, 2)}\n\`\`\`\n`);
}

async function trace(traceId) {
  section('10. One booking, one trace, read back from Jaeger');

  const { body: spans } = await eventually('Jaeger received the spans of the consumers', () => spansOf(traceId), (found) => found.body.filter((span) => span.name.startsWith('process ')).length >= 2);
  const names = [...new Set(spans.map((span) => span.name))];

  must(names.some((name) => name.startsWith('POST /appointments')), 'the trace holds the HTTP request');
  must(names.some((name) => name.includes('notification')), 'the trace holds the consumer of notification');
  must(names.some((name) => name.includes('analytics')), 'the trace holds the consumer of analytics');
  say(`\`GET ${jaeger}/api/v3/traces/${traceId}\`: ${spans.length} spans in one trace, from the processes ${[...new Set(spans.map((span) => span.service))].join(' and ')} (the API and the worker are one consumer group: either may take a delivery). Distinct names:\n\n\`\`\`text\n${names.join('\n')}\n\`\`\`\n`);
}

async function spansOf(traceId) {
  const response = await globalThis.fetch(`${jaeger}/api/v3/traces/${traceId}`);
  const body = response.ok ? await response.json() : {};
  const resources = body.result?.resourceSpans ?? [];

  return { status: response.status, body: resources.flatMap((resource) => resource.scopeSpans.flatMap((scope) => scope.spans.map((span) => ({ name: span.name, service: serviceOf(resource) })))) };
}

function serviceOf(resource) {
  return resource.resource.attributes.find((attribute) => attribute.key === 'service.name')?.value.stringValue ?? 'unknown';
}

/** An infrastructure fault, not a business refusal: a table goes away for one request. Skipped without SENTRY_DSN. */
async function incident() {
  section('11. An unexpected failure reaches the error tracker with the trace id of its request');

  if ((process.env.SENTRY_DSN ?? '') === '') return say('SENTRY_DSN is not set: skipped.');

  const traceId = randomBytes(16).toString('hex');

  sql('alter table notification.notifications rename to notifications_away');
  await call('demo-patient', 'GET', '/notifications', undefined, 500, { traceparent: `00-${traceId}-${randomBytes(8).toString('hex')}-01` });
  sql('alter table notification.notifications_away rename to notifications');

  const { body: reports } = await eventually('GlitchTip received the report', async () => ({ status: 200, body: await reportsOf(traceId) }), (found) => found.body.length > 0);

  say(`GlitchTip holds ${reports.length} event of the trace ${traceId}:\n\n\`\`\`json\n${JSON.stringify(reports[0], null, 2)}\n\`\`\`\n`);
  await call('demo-patient', 'GET', '/notifications?limit=1', undefined, 200);
}

/** Runs one statement in the PostgreSQL container this example started. */
function sql(statement) {
  execFileSync('docker', ['exec', 'ddd-ts-kit-example-postgres-1', 'psql', '-U', process.env.POSTGRES_USER ?? 'app', '-d', process.env.POSTGRES_DB ?? 'app', '-c', statement], { stdio: 'ignore' });
}

/** A start on the half-hour grid, at least this many minutes from now. */
function slotAt(minutesFromNow) {
  return new Date(Math.ceil((Date.now() + minutesFromNow * 60_000) / HALF_HOUR) * HALF_HOUR);
}

function later(instant, slots) {
  return new Date(instant.getTime() + slots * HALF_HOUR).toISOString();
}

async function call(who, method, path, body, expected, headers = {}) {
  const answer = await quietly(who, method, path, body, headers);

  show(who, method, path, answer);
  must(answer.status === expected, `${method} ${path} as ${who} answers ${expected}, got ${answer.status}`);

  return answer.body;
}

async function quietly(who, method, path, body, headers = {}) {
  const response = await globalThis.fetch(api + path, {
    method,
    headers: { authorization: 'Bearer ' + people[who].token, 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();

  return { status: response.status, body: text === '' ? undefined : JSON.parse(text) };
}

/** Asynchronous effects are waited for by asking again, for at most twenty seconds. */
async function eventually(what, ask, satisfied = () => true) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const answer = await ask();

    if (answer.status < 300 && satisfied(answer)) return answer;

    await pause(250);
  }

  return fail(`Timed out waiting until ${what}.`);
}

function must(condition, what) {
  if (!condition) fail('NOT AS DESIGNED: ' + what);
}

function fail(message) {
  say('\n**' + message + '**');
  process.exit(1);
}
