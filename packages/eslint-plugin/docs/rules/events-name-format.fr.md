[English](events-name-format.md) · **Français**
<!-- translation-of: events-name-format.md sha256:3696b2ab4eae3dd8 -->

# ddd-ts-kit/events-name-format

Identifiant d'architecture : `events/name-format`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/events/` et `published-language/` d'un contexte, tests exclus.

## Pourquoi

Le nom d'un événement est une adresse publique : les consommateurs s'y abonnent, le catalogue le liste. `<context>.<aggregate>.<fact>` dit à qui il appartient et ce qui s'est passé.

## Signalé

- dans `domain/events/` : une propriété ou une clé d'objet `eventName` ou `name` dont la chaîne n'est pas `<this context>.<aggregate>.<fact>` en kebab-case
- dans `published-language/` : le `type` donné à `defineIntegrationEvent`, et tout autre `type` qui contient une chaîne à points

Incorrect :

```ts
export class InvoiceIssued implements DomainEvent {
  static readonly eventName = 'InvoiceIssued';

  readonly name = InvoiceIssued.eventName;
}
```

Correct :

```ts
export class InvoiceIssued implements DomainEvent {
  static readonly eventName = 'billing.invoice.issued';

  readonly name = InvoiceIssued.eventName;
}
```

## Détails

Les littéraux de gabarit (template literals) sans interpolation sont lus comme des chaînes. Le nom est déclaré une fois, dans `eventName`, que l'événement porte dans `name` et que ses réactions lisent (`{ name: InvoiceIssued.eventName }`) ; un `readonly name = '..'` écrit en toutes lettres, comme avant la 0.6, est jugé de la même façon.

## Options

Aucune.

`rules."events/name-format"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line events/name-format -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La forme et le préfixe du contexte sont vérifiés, pas la grammaire du fait (le temps passé est vérifié par le générateur).
- Un nom construit à l'exécution (`${context}.invoice.issued`) n'est pas lu.
- Qu'un événement d'intégration soit déclaré une fois, avec un contenu (payload), c'est `ddd-ts-kit check` qui le vérifie (`events/defined-in-published-language`).

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant et possède la règle compagne `events/defined-in-published-language`. Cette règle fait autorité pour le format.
