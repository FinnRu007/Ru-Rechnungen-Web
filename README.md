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
index.html                         Ru-Services: Unternehmen, Bereiche, Grundsätze,
                                   Nachhaltigkeit, Standort (DE- und EU-Flagge), Kontakt
rechnungen/index.html              Rechnungsprogramm: E-Rechnung, ZUGFeRD/FeRD, Video,
                                   Screenshot-Rundgang, Funktionen, Free/Pro, FAQ, Download
rechnungen/pflichtangaben/         Pflichtangaben auf Rechnungen mit Gesetzeslinks
rechnungen/e-rechnung-lesen/       Werkzeug: ZUGFeRD/XRechnung im Browser lesen (leser.js)
vereine/index.html                 Vereine: Vorlage (noindex, in Vorbereitung)
impressum.html                     Impressum (§ 5 DDG)
datenschutz.html                   Datenschutzerklärung (DSGVO)
404.html                           Fehlerseite
styles.css                         komplettes Design (Tokens aus Ru-Design)
script.js                          Menü, Video erst nach Klick, Lightbox, alte Anker
fonts/                             Manrope und Inter (woff2, SIL OFL 1.1)
vendor/pdfjs/                      pdf.js 4.10.38 legacy build (Apache-2.0), nur fürs Werkzeug
img/screenshots/                   Programm-Screenshots
img/flags/                         Flaggen Deutschland und EU (SVG)
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
- **ZUGFeRD-Logo**: nur die offizielle Datei vom FeRD verwenden
  (ferd-net.de > Publikationen > ZUGFeRD-Logo), nur auf weißem Grund, mit
  Schutzraum, nur proportional skaliert, verlinkt auf www.ferd-net.de. Platz
  dafür ist in `rechnungen/index.html` im Abschnitt `#zugferd` vorbereitet
  (auskommentiert). Nach der Veröffentlichung die URL innerhalb einer Woche
  an das FeRD melden.
- **Pflichtangaben-Seite**: Stand Oktober 2026. Bei Gesetzesänderungen
  (UStG, UStDV, BMF-Schreiben) anpassen und das Datum oben ändern.
- **Vereine**: Seite ist `noindex`. Erst wenn die Inhalte stehen, `noindex`
  entfernen und in `sitemap.xml` aufnehmen. Einen Förderhinweis erst nach der
  Bewilligung und nur laut Bescheid einfügen.

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

## Deployment

GitHub Pages: *Settings → Pages*, Branch `main`, Ordner `/` (root), Custom
Domain `ru-services.de`, *Enforce HTTPS* an. Jeder Push auf `main`
veröffentlicht neu.
