**`generate domain-event` refuses a fact that starts with its aggregate.** `generate domain-event ordering Order "Order Confirmed"` used to write `OrderOrderConfirmed`; it now stops and names the form to use, `Confirmed`. `--allow-name` lets a name through that is right as typed.

To move: a project that already holds a stuttering event renames it by hand; nothing else changes.
