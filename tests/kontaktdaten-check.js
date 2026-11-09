// Prüft alle HTML Seiten auf Telefonnummern und E-Mail Adressen.
// Jede gefundene Nummer und Adresse muss mit tests/kontaktdaten.json übereinstimmen.
// Aufruf: node tests/kontaktdaten-check.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const soll = JSON.parse(fs.readFileSync(path.join(__dirname, 'kontaktdaten.json'), 'utf8'));
const ausnahmen = ['vendor', 'node_modules', '.git', 'tests', 'fonts', 'img'];
// Beispielwerte im Werkzeug E-Rechnung erstellen (Musterfirma), keine echten Kontaktdaten
const beispielwerte = ['+495241000000', '05241000000'];
const fehler = [];

function nurZiffern(s) {
  return s.replace(/[^\d+]/g, '').replace(/^0049/, '+49').replace(/^0(?=[1-9])/, '+49');
}

// Deutsche Handynummern: 015x mit 8 Ziffern Rufnummer, 016x und 017x mit 7 oder 8
function handyLaengeOk(e164) {
  const m = e164.match(/^\+49(1[5-7]\d)(\d+)$/);
  if (!m) return true;
  const n = m[2].length;
  return m[1].startsWith('15') ? n === 8 : (n === 7 || n === 8);
}

function pruefeNummer(datei, roh, art) {
  const n = nurZiffern(roh);
  if (beispielwerte.includes(n)) return;
  if (n !== soll.telefon) fehler.push(`${datei}: ${art} "${roh}" weicht ab von ${soll.telefon}`);
  else if (!handyLaengeOk(n)) fehler.push(`${datei}: ${art} "${roh}" hat eine falsche Länge`);
}

function dateien(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (ausnahmen.includes(e.name)) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return dateien(p);
    return /\.(html|txt|xml|json)$/.test(e.name) ? [p] : [];
  });
}

if (!handyLaengeOk(soll.telefon)) fehler.push(`tests/kontaktdaten.json: ${soll.telefon} hat eine falsche Länge`);

for (const f of dateien(ROOT)) {
  const rel = path.relative(ROOT, f);
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/tel:([+\d][\d\s\/().-]*)/g)) pruefeNummer(rel, m[1], 'tel: Link');
  for (const m of text.matchAll(/"telephone"\s*:\s*"([^"]+)"/g)) pruefeNummer(rel, m[1], 'JSON-LD telephone');
  // Sichtbare Nummern: +49 ... oder 0 gefolgt von Vorwahl, mindestens 9 Ziffern
  const ohneTags = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
  for (const m of ohneTags.matchAll(/(?:\+49\s?|0049\s?|\b0)[1-9][\d\s\/-]{7,}\d/g)) {
    if ((m[0].match(/\d/g) || []).length >= 9) pruefeNummer(rel, m[0].trim(), 'Nummer im Text');
  }
  for (const m of text.matchAll(/mailto:([^"?]+)/g)) {
    if (m[1].toLowerCase() !== soll.email) fehler.push(`${rel}: mailto "${m[1]}" weicht ab von ${soll.email}`);
  }
}

if (fehler.length) {
  console.error('Kontaktdaten Prüfung fehlgeschlagen:\n' + fehler.map(f => '  ' + f).join('\n'));
  process.exit(1);
}
console.log('Kontaktdaten Prüfung bestanden: alle Telefonnummern und E-Mail Adressen stimmen.');
