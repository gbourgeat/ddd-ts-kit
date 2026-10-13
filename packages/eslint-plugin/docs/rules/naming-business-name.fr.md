[English](naming-business-name.md) · **Français**
<!-- translation-of: naming-business-name.md sha256:89217992f8690282 -->

# ddd-ts-kit/naming-business-name

Identifiant d'architecture : `naming/business-name`. Sévérité par défaut : `error`. Corrigible (`eslint --fix`) là où le nom est connu.

S'applique à : `domain/` et `application/` de chaque contexte, et au noyau partagé hors de son `presentation/` ; tests exclus. Active par défaut, dans un nouveau projet comme dans un projet existant : une configuration sans `businessNames` lit la liste par défaut.

## Pourquoi

Le code du modèle, c'est le langage omniprésent (ubiquitous language) écrit. Un gestionnaire qui charge un rendez-vous et le nomme `target`, une boucle qui parcourt les rappels échus sous le nom `item`, un paramètre appelé `data` : chacun oblige le lecteur à retraduire la ligne dans les mots du métier, et cache le concept qu'elle manipule. Un nom générique se propage aussi, parce que la ligne suivante s'écrit en copiant la précédente : les gabarits de gestionnaire de commande du kit écrivaient `const target = X.create(..)` jusqu'à la 0.17, et quarante gestionnaires de l'application d'exemple en ont hérité. Nommée d'après son concept, `appointment`, `reminder`, `delegation`, une ligne se lit comme l'expert du domaine la dirait.

## Signalé

Un nom qui est l'un des mots génériques, `target`, `targets`, `data`, `item`, `items`, `obj`, `object`, `thing`, `things`, `stuff`, `info`, `element`, `el`, `tmp`, `temp`, `foo`, `bar` ou `baz`, donné à :

- une variable, `const target = ..` ;
- une variable de boucle, `for (const target of due)` ;
- un nom déstructuré, `const { lines: data } = command`, à toute profondeur ;
- un paramètre d'une fonction, d'une méthode, d'une fonction fléchée, d'une signature abstraite ou de surcharge, d'une signature de méthode d'interface, ou d'un type fonction ;
- une propriété d'une classe (propriétés de paramètre comprises), d'une interface, ou d'un alias de type objet.

Incorrect :

```ts
const target = await this.appointmentRepository.findById(command.appointmentId);

for (const target of due) {
  target.expire(command.at);
}
```

Correct :

```ts
const appointment = await this.appointmentRepository.findById(command.appointmentId);

for (const appointment of due) {
  appointment.expire(command.at);
}
```

## Le correctif

Une variable dont l'initialiseur dit quel concept elle désigne est renommée, avec chacun de ses usages, du nom de ce concept en camelCase :

- `X.create(..)` et `new X(..)`, `X` étant une classe du fichier ou importée du projet (`new Map()` ne dit rien du métier) : `const appointment = Appointment.create(..)` ;
- un appel sur un *repository* : avec l'information de types (les presets du plugin la donnent), le type qu'il répond, une fois attendu et sans `undefined`, quand c'est un agrégat, une entité ou un objet-valeur du projet (`domain/aggregates/`, `domain/entities/`, `domain/value-objects/`, le noyau partagé) ; `appointments` pour une liste. Le *repository* est une instance d'un port de `domain/repositories/`, ou une liaison nommée `<concept>Repository`. Sans information de types, les noms décident : `this.appointmentRepository.findById(..)` (`find`, `get`, `load`, `require`, seuls ou suivis de `One` ou `ById`) désigne un `appointment`, `findDue(..)` reçu par un mot au pluriel (`targets`, `items`, `things`) désigne des `appointments`.

Une propriété abrégée garde sa clé : `{ target }` devient `{ target: appointment }`. La règle signale sans corriger quand le nom est déjà pris (déclaré dans la portée, masqué entre un usage et la déclaration, ou employé dans la portée pour autre chose), quand la variable est exportée, et quand la liaison désigne un élément alors que le nom en dit plusieurs, ou l'inverse. Une variable de boucle n'est jamais corrigée : le message donne le singulier de sa collection (`reminder` pour `dueReminders`, ou le type de l'élément avec l'information de types).

Mettre un projet à jour tient en une commande, puis les signalements qui restent :

```bash
npx eslint . --fix
npx eslint .
```

## Détails

Une clé d'un objet littéral suit le type pour lequel elle est écrite et n'est pas jugée : `{ items, total }` est la forme d'une `Page` du noyau. Un type littéral imbriqué dans une annotation, `props: { data: string }`, n'est pas non plus une déclaration du modèle. Une clause `catch` n'est pas jugée.

## Options

`words` : les mots génériques, à la place de la liste par défaut. `allow` : des mots retirés de la liste.

```js
'ddd-ts-kit/naming-business-name': ['error', { allow: ['info'] }]
```

Les deux options passent par-dessus `businessNames` de `ddd-ts-kit.config.json`, `{ "words": [..], "allow": [..] }`, que lit aussi `ddd-ts-kit check` : gardez la liste là, pour que les deux analyseurs jugent les mêmes noms. `rules."naming/business-name"` à `off` fait taire la règle, et `// ddd-ts-kit-disable-next-line naming/business-name -- <raison>` fait taire une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- L'infrastructure, la présentation, la plateforme et les tests ne sont pas jugés : un adaptateur parle les mots de sa bibliothèque, et une spec ceux de son scénario. Un *serializer* de `presentation/` gagne tout de même à être nommé d'après ce qu'il sérialise.
- Un mot générique à l'intérieur d'un nom plus long (`targetDate`, `itemCount`) n'est pas signalé : il est qualifié. `language/no-technical-name` juge les noms des classes et des cas d'usage.
- Sans information de types, un *repository* dont la méthode ne nomme ni un élément ni plusieurs (`save`, `search`, `count`) ne reçoit aucune proposition.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers, avec la même liste et aux mêmes endroits, et propose le nom de la classe qu'un initialiseur construit ou du *repository* qu'il lit. Cette règle fait autorité, et c'est elle qui renomme.
