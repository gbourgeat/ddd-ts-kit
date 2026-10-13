[English](application-command-query-separation.md) · **Français**
<!-- translation-of: application-command-query-separation.md sha256:71759990f27562b5 -->

# ddd-ts-kit/application-command-query-separation

Identifiant d'architecture : `application/command-query-separation` (ajouté par ce *plugin*). Sévérité par défaut : `warn` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers sous `application/queries/` d'un contexte, tests exclus.

## Pourquoi

Une requête répond et ne change jamais l'état : on peut alors la relancer, la mettre en cache et l'exécuter sur une réplique. Une requête qui enregistre est une commande avec une valeur de retour.

## Signalé

- un appel de `save`, `delete` ou `publish` sur quelque chose que tient le gestionnaire (`this.invoices.save(...)`, `this.#bus.publish(...)`)

Incorrect :

```ts
export class SearchInvoicesHandler {
  async execute(query: SearchInvoicesQuery): Promise<SearchInvoicesResult> {
    await this.audit.save(query);
    return this.reader.read(query);
  }
}
```

Correct :

```ts
export class SearchInvoicesHandler {
  async execute(query: SearchInvoicesQuery): Promise<SearchInvoicesResult> {
    return this.reader.read(query);
  }
}
```

## Détails

Pragmatique par conception : la règle reconnaît des noms de méthodes sur les dépendances atteintes par `this`. Un `Set` local dont on appelle `delete` n'est pas signalé.

## Options

`[{ "mutators": ["save", "delete", "publish"] }]` remplace la liste des noms de méthodes.

`rules."application/command-query-separation"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line application/command-query-separation -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une modification derrière un autre nom (`upsert`, `record`) demande l'option `mutators`.
- Une dépendance passée en argument plutôt qu'injectée n'est pas suivie.
- L'autre moitié du principe, une commande qui renvoie plus qu'un identifiant, est laissée à la revue.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
