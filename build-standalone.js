/* Génère FretScaleWeb-standalone.html : un seul fichier HTML avec CSS et JS
 * intégrés. Pratique à copier sur un téléphone (aucun dossier à garder).
 * Usage : node build-standalone.js
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const scripts = ['js/model.js', 'js/view.js', 'js/controller.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'));

const tags = [
  '<script src="js/model.js"></script>',
  '<script src="js/view.js"></script>',
  '<script src="js/controller.js"></script>'
];

let out = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n  </style>');
tags.forEach(function (tag, i) {
  out = out.replace(tag, '<script>\n' + scripts[i] + '\n  </script>');
});

if (out.indexOf('<link rel="stylesheet"') !== -1 || out.indexOf('src="js/') !== -1) {
  throw new Error('Le modèle index.html a changé : les balises à remplacer sont introuvables.');
}

const dest = path.join(dir, 'FretScaleWeb-standalone.html');
fs.writeFileSync(dest, out, 'utf8');
console.log('Généré : ' + dest + ' (' + out.length + ' octets)');
