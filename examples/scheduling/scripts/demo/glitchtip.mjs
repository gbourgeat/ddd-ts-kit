// Reads the local GlitchTip of docker compose with its development account (created by its own
// bootstrap, local development only): the events of the first project, with their tags.
import process from 'node:process';

const glitchtip = 'http://127.0.0.1:' + (process.env.GLITCHTIP_PORT ?? '54800');

/** The reported events whose trace context is this trace; empty until the report arrived. */
export async function reportsOf(traceId) {
  const cookie = await session();
  const issues = await read('/api/0/organizations/org/issues/?limit=20', cookie);
  const events = await Promise.all(issues.map((issue) => read(`/api/0/issues/${issue.id}/events/latest/`, cookie)));

  return events.filter((event) => event.contexts?.trace?.trace_id === traceId).map(summaryOf);
}

async function session() {
  const config = await globalThis.fetch(glitchtip + '/_allauth/browser/v1/config');
  const csrf = cookiesOf(config);
  const token = /csrftoken=([^;]+)/.exec(csrf)?.[1] ?? '';
  const login = await globalThis.fetch(glitchtip + '/_allauth/browser/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrftoken': token, cookie: csrf },
    body: JSON.stringify({ email: 'test@example.com', password: 'admin_pass' }),
  });

  return [csrf, cookiesOf(login)].join('; ');
}

function cookiesOf(response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
}

async function read(path, cookie) {
  const response = await globalThis.fetch(glitchtip + path, { headers: { cookie } });

  return response.ok ? response.json() : [];
}

/** What the transcript shows of an event: where it came from, never the machine it ran on. */
function summaryOf(event) {
  const tags = Object.fromEntries((event.tags ?? []).map((tag) => [tag.key, tag.value]));

  return { type: event.metadata?.type, traceId: event.contexts.trace.trace_id, operation: tags.operation, origin: tags.origin, errorCode: tags.error_code, correlationId: tags.correlation_id, actorId: tags['user.id'] };
}
