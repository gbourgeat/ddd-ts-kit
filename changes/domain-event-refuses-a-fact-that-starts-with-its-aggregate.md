**`generate domain-event` refuses a fact that starts with its aggregate.** `generate domain-event ordering Order "Order Confirmed"` used to write `OrderOrderConfirmed`; it now stops and names the form to use, `Confirmed`. The refusal applies where the event would be created: `generate domain-event`, and `event-handler` or `integration-event` when the event file is absent; a handler for an event that exists is never refused. `--allow-name` lets a name through that is right as typed.

To move: a project that already holds a stuttering event renames it by hand; nothing else changes.
