# FretScaleWeb 🎸

GithubPage: https://nyxover.github.io/FretScale-Web/

WebApp mobile qui **écoute** les notes/accords joués à la guitare ou à la basse
(microphone) et affiche le résultat sur un **manche**, un **petit clavier de piano**
et une **grille de tonalité 5 × 8**, avec des **progressions d'accords diatoniques**
(dominante V → tonique, note sensible, notes cibles).

## Lancer

Deux possibilités :

1. **Le plus simple** : ouvrir `FretScaleWeb-standalone.html` dans le navigateur
   (un seul fichier, aucun serveur, copiable sur téléphone).
2. **Version source** : ouvrir `index.html` en gardant `style.css` et `app.js`
   dans le même dossier.

Le micro demande un contexte sécurisé : **HTTPS** ou **localhost**. En fichier
local (`file://`), les réglages, le manche, le clavier et les progressions
fonctionnent, mais le micro peut être bloqué (notamment sur iOS). Pour l'activer
sur téléphone, sers le dossier en local, par exemple :

```bash
python -m http.server 8000
# puis ouvre http://<IP-du-PC>:8000/index.html depuis le téléphone
```

## Utilisation

- **Activer le micro** : joue une note (YIN) ou un accord strummé (analyse FFT) ;
  la note jouée, l'accord détecté et la stabilité du signal s'affichent en direct.
- **Tonique** : champ de saisie + **12 pâtons d'accès rapide** (sans clavier,
  pratique sur téléphone). La saisie n'est plus réécrite pendant la frappe ;
  l'orthographe ♯/♭ est normalisée à la validation.
- **Gamme / Progression / Longueur / Instrument** : réglages en direct.
- **Manche cliquable** : touche une frette (guitare 6 cordes ou **basse 4
  cordes**) → la note est jouée et un **conseil** s'affiche : tonique, note de
  l'accord, note sensible ou note de passage, avec la **meilleure note voisine
  conseillée**.
- **PC** : au-delà de 1200 px, la page est réorganisée en **3 colonnes flex**
  (réglages / direct + manche + clavier / progression + riff + tablature +
  théorie). Les panneaux s'empilent sans case vide et sans aucun défilement,
  ni de page ni interne. Les longs textes sont repliés (`▸ Comprendre…`,
  cliquables). En mode super noob, le clavier et la théorie s'effacent pour
  laisser la tablature, dont les cartes s'affichent en grille de 2 colonnes.
- **1920 px et +** : colonnes plus larges, typographie et cases agrandies.
- **🤓 Mode super noob** (`Affichage`) : affiche une **tablature** avec les
  numéros de cases à presser pour la note/accord détecté **et** pour chaque
  accord de la progression. `x` = corde à ne pas jouer, chiffre = case.
  Adapté guitare (6 cordes) comme basse (4 cordes). En mode basse, une
  **tablature « 2 cordes ensemble »** s'ajoute avec l'astuce pour faire une
  barre d'un doigt et gratter les deux cordes en même temps (racine + quinte).
- **Générer progression** : enchaînement diatonique (ex. en do majeur :
  `C – G – Am – F`). La dominante est marquée en rouge, sa résolution en vert.
  Chaque ligne donne le degré (I, V, vi…), le nom de l'accord et ses 3 notes.
  Cliquer une ligne charge l'accord dans le riff. Une explication est affichée
  au-dessus de la liste.
- **Riff ASCII · 16 temps** : dès que tu joues une note (micro, piano, grille,
  manche) ou que tu cliques un accord, un riff ASCII de 16 temps est généré.
  Le sélecteur **Ambiance** change le rythme et le style (calme, groove, rock,
  reggae, jazz, métal) ; « ↻ Regénérer » crée une **nouvelle variation** (autre
  prise, autre corde, autre octave) et l'indique dans la légende. Chiffre = case,
  `---` = silence. Fonctionne en guitare (6 lignes) comme en basse (4 lignes).
- **Écouter** : joue la progression (clic qui marche sans micro).
- **Touches du piano et cases de la grille** : tapables pour écouter une note
  et la voir s'allumer sur le manche. La grille 5 × 8 est une **carte des notes**
  (milieu = tonique, bleu = gamme, vert = accord, rose = note sensible) : elle
  n'est pas à jouer, une explication est affichée juste au-dessus.

En mode mineur, la dominante V est « harmonisée » (3<sup>e</sup> élevée) pour
obtenir une vraie note sensible et une résolution V → i.

## Fichiers

- `index.html` : structure HTML.
- `style.css` : styles responsive (téléphone, PC, écrans 1920 px).
- `js/model.js` : **Modèle** — état, théorie musicale (gammes, accords
  diatoniques, dominante), détection YIN/FFT, prises de tablature, conseils,
  génération du riff. Aucun accès au DOM.
- `js/view.js` : **Vue** — uniquement le rendu DOM (manche, piano, grille,
  progression, riff, tablatures, conseils).
- `js/controller.js` : **Contrôleur** — événements, microphone/audio,
  orchestration Model → View. Expose `window.FretScaleWeb` pour les tests.
- `FretScaleWeb-standalone.html` : fichier unique généré (les 3 modules y sont
  intégrés dans l'ordre Modèle → Vue → Contrôleur).
- `build-standalone.js` : régénère le fichier unique :
  `node build-standalone.js`.

Aucune dépendance externe, fonctionne hors ligne.
