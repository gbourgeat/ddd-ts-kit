**`generate aggregate --event-sourced --birth <Event>` names the birth event after the business.**
The birth event of an event-sourced aggregate was always `<Name>Created`, and the generator refused
until `Created` was a term of the glossary, so an agent defined a word the business never says.
`--birth Triggered` writes `IncidentTriggered` (`incidents.incident.triggered`) for the event class,
its type, the codec of the stored events, the builder and the specs, checked against the glossary
and as a past fact like any event name. `Created` stays the default. `--birth` without
`--event-sourced` is refused. The `scaffold` skill says to pass it with the word of the glossary.
