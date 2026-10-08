# Ru-Rechnungen-Web

Website von **Ru-Services** unter <https://ru-services.de>. Statisches
HTML/CSS/JS, kein Build-Schritt, läuft über GitHub Pages mit eigener Domain
(`CNAME`).

Design nach dem gemeinsamen Regelwerk in
[`Ru-Design/DESIGN.md`](https://github.com/FinnRu007/Ru-Design). Einzige
Abweichung: Die Schriften liegen lokal unter `fonts/` statt über Google Fonts
(Datenschutz, keine Verbindung zu Google beim Seitenaufruf).

## Struktur

```
index.html                         Ru-Services: Unternehmen, Angebot, Grundsätze,
                                   Nachhaltigkeit, Standort (DE- und EU-Flagge), Kontakt
rechnungen/index.html              Rechnungsprogramm: E-Rechnung, ZUGFeRD/FeRD, Video,
                                   Screenshot-Rundgang, Funktionen, Free/Pro, FAQ, Download
rechnungen/pflichtangaben/         Pflichtangaben auf Rechnungen mit Gesetzeslinks
rechnungen/e-rechnung-lesen/       Werkzeug: ZUGFeRD/XRechnung im Browser lesen (leser.js)
vereine/index.html                 KI-Wissensportal für Vereine: eigenständiges,
                                   gefördertes Projekt (grün, eigene Navigation)
impressum.html                     Impressum (§ 5 DDG)
datenschutz.html                   Datenschutzerklärung (DSGVO)
404.html                           Fehlerseite
styles.css                         komplettes Design (Tokens aus Ru-Design)
script.js                          Menü, Video erst nach Klick, Lightbox, alte Anker,
                                   Kopieren-Knopf
fonts/                             Manrope und Inter (woff2, SIL OFL 1.1)
vendor/pdfjs/                      pdf.js 4.10.38 legacy build (Apache-2.0), nur fürs Werkzeug
img/screenshots/                   Programm-Screenshots
img/flags/                         Flaggen Deutschland und EU (SVG)
img/foerderung/                    Logo Landesprogramm 2.000 x 1.000 Euro (NRW)
robots.txt, sitemap.xml, llms.txt  Suchmaschinen und KI-Assistenten
```

Alle Pfade sind absolut (`/styles.css`), weil die Seite unter der eigenen
Domain im Wurzelverzeichnis liegt. Lokal testen: `python3 -m http.server`
im Repo-Ordner, dann <http://localhost:8000>.

## Rechtliches, bitte beachten

- **Erklärvideo**: wird erst nach Klick auf „Video laden“ von YouTube geladen
  (Zwei-Klick-Lösung). Die Video-ID steht in `rechnungen/index.html` im
  Attribut `data-video-id`.
- **Keine externen Ressourcen** beim Seitenaufruf (keine Google Fonts, kein CDN,
  kein Tracking). Neue Einbindungen immer erst in `datenschutz.html` aufnehmen.
- **ZUGFeRD-Logo**: `img/zugferd/zugferd-logo.svg` (Datei von ferd-net.de,
  nur der graue Vorschau-Rahmen entfernt). Eingebunden in `rechnungen/index.html`
  im Abschnitt `#zugferd`, verlinkt auf www.ferd-net.de. Regeln: nur auf weißem
  Grund, Freiraum der Datei erhalten, nur proportional skalieren. Jeden neuen
  Verwendungsort innerhalb einer Woche nach Veröffentlichung an das FeRD melden
  (wingender@awv-net.de).
- **Pflichtangaben-Seite**: Stand Oktober 2026. Bei Gesetzesänderungen
  (UStG, UStDV, BMF-Schreiben) anpassen und das Datum oben ändern.
- **Vereine**: gefördert durch das Land NRW („2.000 x 1.000 Euro für das
  Engagement“, bewilligt Oktober 2026). Streng getrennt: Startseite, Rechnungen,
  Impressum und Datenschutz verlinken nicht auf /vereine/, und die Vereinsseite
  nennt Ru-Services nur dezent (Fußzeile, E-Rechnung-Leser, „Wer steckt
  dahinter“). Keine Preise, kein Download-Knopf, keine Werbung auf der
  geförderten Seite. Förderhinweis steht in
  `#foerderung` und oben im Hero, mit dem Programmlogo
  `img/foerderung/logo-2000x1000-engagement-nrw.png` (unverändert, auf weißem
  Grund, nur proportional skalieren). Vorgaben aus dem
  Bewilligungsbescheid haben Vorrang. Vereine nur mit deren Einverständnis
  namentlich nennen.

## Pflege

- **Screenshots**: PNGs nach `img/screenshots/` legen (Namen siehe
  `img/screenshots/README.md`).
- **Neue Programmversion**: als GitHub-Release in **diesem** Repo
  veröffentlichen und die `.exe` **zweimal** als Asset anhängen:
  1. `Ru-Services-Setup-<version>.exe` (zur Nachvollziehbarkeit)
  2. `Ru-Services-Setup.exe` (**fester Name ohne Version**, darauf zeigt der Download-Button)

  Release als *Latest* markieren. Die Website muss dann nicht angefasst werden.
- **Preise**: in `rechnungen/index.html` (Text, Tabelle, JSON-LD `offers`)
  und in `llms.txt`.
- **Ort**: auf der Website steht als Sitz nur „Nordrhein-Westfalen“. Die volle
  Anschrift steht nur dort, wo sie Pflicht ist (Impressum, Datenschutz).

## Deployment

GitHub Pages: *Settings → Pages*, Branch `main`, Ordner `/` (root), Custom
Domain `ru-services.de`, *Enforce HTTPS* an. Jeder Push auf `main`
veröffentlicht neu.
