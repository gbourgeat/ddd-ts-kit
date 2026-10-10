import type { ExpectedSpan } from '../../../src/testing.js';

/** What booking an appointment looks like up to the outbox, with what follows the append given as its children. */
export function bookingTree(afterAppend: readonly ExpectedSpan[] = []): ExpectedSpan {
  return {
    name: 'POST /appointments',
    kind: 'SERVER',
    attributes: { 'http.route': '/appointments', 'app.operation': 'bookAppointment', 'http.response.status_code': 201, 'app.origin': 'http', 'app.outcome': 'succeeded' },
    children: [
      {
        name: 'command BookAppointment',
        kind: 'INTERNAL',
        attributes: { 'app.context': 'scheduling', 'app.use_case.kind': 'command', 'app.outcome': 'succeeded' },
        children: [
          { name: 'repository AppointmentRepository.findOverlapping', kind: 'INTERNAL', attributes: { 'app.context': 'scheduling' } },
          {
            name: 'repository AppointmentRepository.save',
            kind: 'INTERNAL',
            attributes: { 'code.namespace': 'InMemoryAppointmentRepository', 'code.function': 'save', 'app.dependency.kind': 'repository' },
            children: [
              {
                name: 'domain-event scheduling.appointment.booked',
                kind: 'INTERNAL',
                children: [
                  {
                    name: 'handler AppointmentBookedPublisher',
                    kind: 'INTERNAL',
                    attributes: { 'app.dependency.kind': 'domain-event-handler', 'app.context': 'scheduling' },
                    children: [
                      {
                        name: 'outbox append scheduling.appointment.booked',
                        kind: 'INTERNAL',
                        attributes: { 'messaging.system': 'outbox', 'messaging.operation.type': 'create', 'messaging.message.id': 'id-2' },
                        children: afterAppend,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** The consumer of the notification context, at one delivery. */
export function confirmationTree(attempt = 1): ExpectedSpan {
  return {
    name: 'process notification.appointment-booked',
    kind: 'CONSUMER',
    attributes: {
      'app.context': 'notification',
      'messaging.destination.name': 'scheduling.appointment.booked',
      'messaging.operation.type': 'process',
      'messaging.message.id': 'id-2',
      'messaging.consumer.group.name': 'notification.appointment-booked',
      'app.messaging.attempt': attempt,
      'app.messaging.redelivered': attempt > 1 ? true : undefined,
      'app.origin': 'event',
      'app.outcome': 'succeeded',
    },
    children: [
      {
        name: 'command SendBookingConfirmation',
        attributes: { 'app.context': 'notification' },
        children: [{ name: 'external MailGateway.send', attributes: { 'code.namespace': 'RecordingMailGateway', 'app.dependency.kind': 'external' } }],
      },
    ],
  };
}

/** The consumer of the analytics context. */
export function recordingTree(): ExpectedSpan {
  return {
    name: 'process analytics.appointment-booked',
    kind: 'CONSUMER',
    attributes: { 'app.context': 'analytics', 'app.messaging.attempt': 1, 'app.outcome': 'succeeded' },
    children: [
      { name: 'command RecordBooking', attributes: { 'app.context': 'analytics' }, children: [{ name: 'repository BookingRepository.save' }] },
    ],
  };
}
