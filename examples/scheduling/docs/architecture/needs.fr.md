[English](needs.md) · **Français**
<!-- translation-of: needs.md sha256:3641478a9cb6e060 -->

# Expression des besoins

Exprimée par le *product owner* d'un réseau de cabinets professionnels (médicaux, paramédicaux,
juridiques : tout cabinet qui reçoit des personnes sur rendez-vous), le 2026-10-10. Cette page est
la seule entrée de la méthode : tout ce qui se trouve sous `docs/architecture/` et `src/` en découle.

## Qui nous sommes

Nous exploitons une plateforme sur laquelle des cabinets indépendants publient leurs calendriers
et prennent des rendez-vous. Un cabinet emploie des praticiens, qui reçoivent des patients, et des
assistants, qui tiennent l'accueil. Un responsable de cabinet administre un cabinet. Nous, la
plateforme, ouvrons les cabinets et répondons aux demandes de support de tout le monde.

## Ce dont nous avons besoin

1. **Publier les disponibilités.** Un praticien a un ou plusieurs calendriers dans un cabinet. Un
   calendrier a des horaires d'ouverture hebdomadaires, avec plusieurs plages par jour (matin et
   après-midi), des exceptions (un jour fermé, une ouverture exceptionnelle) et des
   indisponibilités. Chaque type de rendez-vous a une durée et commence sur une grille (toutes les
   15 minutes, toutes les 30 minutes) ; un battement peut être gardé libre entre deux rendez-vous.
   Un cabinet vit dans un seul fuseau horaire et les horaires sont ceux de son horloge murale, quelle
   que soit la saison.
2. **Réserver.** Un patient réserve pour lui-même un créneau libre, pas plus tôt qu'un préavis
   minimal et pas plus loin qu'un horizon maximal. Deux personnes n'occupent jamais le même temps sur
   un calendrier, même quand elles cliquent au même instant. Un patient détient au plus quelques
   rendez-vous futurs avec le même praticien.
3. **Suivre un rendez-vous.** Une réservation qui le demande est confirmée par le patient, ou
   expire. Un rendez-vous est déplacé, annulé (nous gardons qui a annulé et pourquoi), terminé, ou
   marqué comme une absence. Déplacer un rendez-vous ne laisse jamais le patient sans créneau ni
   avec deux.
4. **Attendre une journée complète.** Quand une journée est complète, un patient rejoint sa liste
   d'attente. Quand un créneau se libère, la première personne en attente à qui il convient le voit
   réservé pour elle un court moment, puis la suivante.
5. **Déléguer.** Un praticien laisse un assistant gérer ses calendriers : réserver, déplacer,
   annuler. Ces calendriers seulement. Changer les horaires d'ouverture se délègue explicitement ou
   pas du tout. Une délégation peut prendre fin à une date, et peut être retirée à tout moment.
6. **Garder chaque cabinet à part.** Un responsable de cabinet gère chaque calendrier de son
   cabinet et ne voit rien d'un autre cabinet. Un patient ne voit et n'annule que ses propres
   rendez-vous, et annule librement jusqu'à 24 heures avant ; ensuite, c'est le cabinet qui décide.
   Un praticien annule n'importe quel rendez-vous de ses calendriers à tout moment, et dit pourquoi.
   Dans une vue partagée d'un calendrier, un patient voit qu'un créneau est pris, jamais par qui.
7. **Prévenir les gens.** Les patients reçoivent une confirmation, un rappel 24 heures avant, et un
   avis quand un rendez-vous est déplacé ou annulé. Un rappel est envoyé une seule fois.
8. **Mesurer.** Un cabinet suit l'occupation de ses calendriers, ses annulations et ses absences,
   par jour.
9. **Support et responsabilité.** Notre équipe de support peut regarder ce que voit un
   utilisateur, en son nom, et ne rien changer ; chacun de ces regards est enregistré. Nous devons
   pouvoir dire qui a fait quoi, à qui on a refusé quoi, et quand.

## Contraintes

- Les gens se connectent par le fournisseur d'identité que nous hébergeons (Keycloak). La
  plateforme connaît une personne par l'identité qu'il émet.
- Une seule application déployable aujourd'hui (un monolithe modulaire), avec un processus à part
  pour le travail déclenché par le temps ; n'importe quelle partie pourra devoir être extraite plus
  tard.
- PostgreSQL détient les données. Un seul serveur au protocole Redis (Dragonfly) sert le cache, le
  limiteur de débit, le verrou du travail planifié et les flux d'événements.
- Tout est tracé, journalisé et remonté avec un identifiant par action.

## Hors périmètre

Paiement, téléconsultation, dossiers médicaux, parcours d'auto-inscription des patients du
fournisseur d'identité, calendriers partagés par plusieurs praticiens, rendez-vous récurrents.
