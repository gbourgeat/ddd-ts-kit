**`events/consumer-idempotent` accepts options spread from a shared object.**
`consume(definition, { ...options, consumer: 'ctx.name' }, handler)` passes when `options` is a
`const` of the same file initialised with an object literal that carries `processed`, or a value typed
`ConsumeOptions`; the consumer name is still read as the literal `consumer` key. A spread whose content
the file does not show is still refused, and the fix says that `processed` cannot be read.
