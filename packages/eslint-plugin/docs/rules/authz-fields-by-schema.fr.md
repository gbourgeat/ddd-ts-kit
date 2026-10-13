[English](authz-fields-by-schema.md) · **Français**
<!-- translation-of: authz-fields-by-schema.md sha256:9de6682c7652dfbf -->

# ddd-ts-kit/authz-fields-by-schema

Identifiant d'architecture : `authz/fields-by-schema`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `application/queries/` d'un contexte, tests exclus.

## Pourquoi

Une requête qui retire un champ pour les appelants sans rôle répond d'une façon en JSON et est
oubliée dans l'export CSV, le XML d'un partenaire et le formulaire du front-end ; personne qui
lit le contrat ne sait que le champ peut manquer. Marqué sur le schéma de réponse avec
`withFieldAccess` de `@ddd-ts-kit/http`, le champ est réservé une seule fois à une permission ou
à une politique : le *pipeline* l'écarte de toute représentation pour un acteur qui ne peut pas
le lire, le refuse dans un corps de requête HTTP venant d'un acteur qui ne peut pas le poser, le
contrat le dit avec `x-field-access`, et un formulaire décrit par le serveur le montre en lecture
seule ou pas du tout. Quelles lignes l'acteur peut lire reste, en tout état de cause, le
périmètre d'accès de la requête.

## Signalé

- un appel de `includes`, `some`, `every`, `find` ou `indexOf` sur une propriété `roles`
- une comparaison (`===`, `!==`, `==`, `!=`) d'une propriété `role`
- une lecture d'une propriété `isAdmin`

Incorrect :

```ts
export class GetAppointmentHandler {
  async execute(query: GetAppointmentQuery): Promise<AppointmentView> {
    const view = await this.appointments.findById(query.appointmentId);

    return query.actor.roles.includes('practitioner') ? view : { ...view, internalNote: undefined };
  }
}
```

Correct :

```ts
// application/queries/get-appointment/get-appointment.handler.ts
return this.appointments.findById(query.appointmentId);

// presentation/http/appointments/get-appointment/get-appointment.controller.ts
const answer = withFieldAccess(classSchema(GetAppointmentAnswer), {
  internalNote: { read: { permission: schedulingPermissions['appointment.note.read'] } },
});
```

## Checker

`ddd-ts-kit check` signale les mêmes tests sous le même identifiant, à partir du texte du fichier.
