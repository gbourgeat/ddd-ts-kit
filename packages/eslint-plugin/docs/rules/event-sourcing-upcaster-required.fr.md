[English](event-sourcing-upcaster-required.md) · **Français**
<!-- translation-of: event-sourcing-upcaster-required.md sha256:0bea912680058623 -->

# ddd-ts-kit/event-sourcing-upcaster-required

Identifiant d'architecture : `event-sourcing/upcaster-required`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque source d'un contexte qui appelle `defineStoredEvent(Event, { ... })`, tests exclus.

## Pourquoi

Les événements stockés ne sont jamais réécrits : un événement stocké il y a des années est lu par le code d'aujourd'hui. Le type des données d'un événement stocké est son contrat avec le passé ; il est donc nommé et déclaré à côté du codec, et un changement de ce type est une nouvelle version lue par un *upcaster*.

## Signalé

- un `encode` dont le type de retour n'est pas un type nommé
- un type nommé non déclaré dans le fichier
- un type nommé qu'atteignent les données (un champ typé `SlotData`, un `extends`, un argument de type) et que le fichier ne déclare pas, le `PersonalValue` du kit mis à part : un changement de ce type changerait la forme stockée et non son empreinte
- une `version` supérieure à 1 sans *upcaster* depuis chaque version inférieure

Incorrect :

```ts
'scheduling.attendance-record.no-show-noted': defineStoredEvent(NoShowNoted, {
  version: 2,
  encode: (event) => ({ appointmentId: event.appointmentId, reason: event.reason }),
  decode,
}),
```

Correct :

```ts
interface NoShowNotedData { readonly appointmentId: string; readonly reason: string }

'scheduling.attendance-record.no-show-noted': defineStoredEvent(NoShowNoted, {
  version: 2,
  encode: (event): NoShowNotedData => ({ appointmentId: event.appointmentId, reason: event.reason }),
  decode,
  upcasters: { 1: (data) => ({ ...data, reason: '' }) },
}),
```

## Options

Aucune.

`rules."event-sourcing/upcaster-required"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line event-sourcing/upcaster-required -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une forme changée sur place sans relever la version n'est vue que par `ddd-ts-kit check`, par comparaison avec `stored-events.lock.json` : cette règle lit un seul fichier.

## Avec le checker de la CLI

`ddd-ts-kit check` tient les mêmes vérifications et, seul, le fichier de verrouillage (`stored-events.lock.json`) : l'empreinte de chaque version enregistrée par `ddd-ts-kit docs --stored-events` dans `stored-events.lock.json` (le type des données et chaque type du fichier qu'il atteint), une forme enregistrée qui a changé, une version inférieure à la dernière enregistrée.

Quelle porte tient quoi : ESLint et `ddd-ts-kit check` jugent chaque codec tel qu'il est écrit ; `ddd-ts-kit docs --check` (`npm run docs:check`, lancé par le *pipeline* généré) échoue tant qu'une version déclarée dans un codec n'est pas enregistrée dans `stored-events.lock.json`, si bien qu'une version ne peut pas atteindre la branche principale sans être enregistrée ; et `ddd-ts-kit check` refuse ensuite tout changement d'une forme enregistrée.
