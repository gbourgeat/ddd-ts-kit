/**
 * The attributes a project gives a name and a type to, by declaration merging. They stay in
 * the `attributes` bag, where authorizers already read them, and are optional when read: the
 * anonymous and system actors carry none.
 *
 *     declare module '@ddd-ts-kit/kernel' {
 *       interface ActorExtensions { readonly department: string }
 *     }
 */
export interface ActorExtensions {}
