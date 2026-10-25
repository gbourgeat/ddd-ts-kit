**The identity preset is written in the explicit style and under NestJS: `init --di manual --preset
identity` and `init --http nest --di nest --preset identity`.** The classes of the context are written
without the declarations of the kernel, a policy carrying its name and its permission, and the preset
lays out `identity.module.ts` whole once the generators ran: its adapters, its use cases with the
permission each requires, the publishers of its facts, the consumers that keep the identity provider
in line (each with its consumer name, the processed-event store and the unit of work), and its
routes, in short functions named after what they wire, the regions of the generators kept. Its
policies join `access-policies.ts` of the platform, and the world of its specs wires the fakes the
way the module wires the adapters. Under NestJS the routes are mounted with those of the other
contexts by the app module of the platform. The explicit style stays refused on tsyringe, which
reads the declarations, and `--dependencies signature` is asked of the declared style only.

To move: nothing for an existing project.
