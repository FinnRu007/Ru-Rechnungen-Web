# Ru-Rechnungen-Web

Website von **Ru-Services** unter <https://ru-services.de>. Statisches
HTML/CSS/JS, kein Build-Schritt, läuft über GitHub Pages mit eigener Domain
(`CNAME`).

Design nach dem gemeinsamen Regelwerk in
[`Ru-Design/DESIGN.md`](https://github.com/FinnRu007/Ru-Design). Abweichungen:
Die Schriften liegen lokal unter `fonts/` statt über Google Fonts
(Datenschutz, keine Verbindung zu Google beim Seitenaufruf). Seit Oktober 2026
ist die Website bewusst konservativer gestaltet (Zielgruppe kleine Betriebe
und Handwerk): dunkleres Blau `#1E3A8A`, kleine Ecken, größere Schrift, keine
verspielten Effekte, Ansprache mit „Sie“.

## Struktur

```
index.html                         Ru-Services: Unternehmen, Angebot, Grundsätze,
                                   Nachhaltigkeit, Standort (DE- und EU-Flagge), Kontakt
rechnungen/index.html              Rechnungsprogramm: E-Rechnung, ZUGFeRD/FeRD, Video,
                                   Screenshot-Rundgang, Funktionen, Free/Pro, FAQ, Download
rechnungen/pflichtangaben/         Pflichtangaben auf Rechnungen mit Gesetzeslinks
rechnungen/e-rechnung-erstellen/   Werkzeug: E-Rechnung (ZUGFeRD, Profil EN 16931, PDF/A-3)
                                   im Browser erstellen. erzeugen.js = Berechnung, XML, PDF;
                                   ersteller.js = Formular, Vorschau, Download; srgb.icc
rechnungen/e-rechnung-lesen/       Werkzeug: ZUGFeRD/XRechnung im Browser lesen (leser.js)
vereine/index.html                 KI-Wissensportal für Vereine: eigenständiges,
                                   gefördertes Projekt (grün, eigene Navigation)
impressum.html                     Impressum (§ 5 DDG)
datenschutz.html                   Datenschutzerklärung (DSGVO)
404.html                           Fehlerseite
styles.css                         komplettes Design (Tokens aus Ru-Design)
script.js                          Menü, Video erst nach Klick, Lightbox, alte Anker,
                                   Kopieren-Knopf
fonts/                             Manrope und Inter (woff2, SIL OFL 1.1), Liberation Sans
                                   (ttf, unverändert, SIL OFL 1.1) für die Rechnungs-PDF
vendor/pdfjs/                      pdf.js 4.10.38 legacy build (Apache-2.0), für beide Werkzeuge
vendor/pdf-lib/                    pdf-lib 1.17.1 und @pdf-lib/fontkit 1.1.1 (MIT), nur für
                                   „E-Rechnung erstellen“, wird erst beim Erstellen geladen
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
  Engagement“, bewilligt Oktober 2026). Getrennt: Startseite, Rechnungen, Impressum
  und Datenschutz zeigen nur den Menüreiter „Vereine“, sonst keine Inhalte
  zum Projekt, und die Vereinsseite
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

## Werkzeug „E-Rechnung erstellen“ prüfen

Nach Änderungen an `rechnungen/e-rechnung-erstellen/erzeugen.js` eine
Beispielrechnung erzeugen und mit einem Prüfwerkzeug prüfen, zum
Beispiel Mustang (`java -jar Mustang-CLI.jar --action validate --source
Rechnung.pdf`, prüft PDF/A-3 mit veraPDF und die XML mit den
EN-16931-Regeln) oder mit den Prüfdateien aus dem FeRD-Paket ZUGFeRD 2.5.2.
Stand 24.10.2026: Beispiele mit 19 %, 7 %, Kleinunternehmer, Leistungszeitraum
und mehrseitiger Rechnung sind gültig (PDF/A-3B konform, 0 Regelverstöße),
ebenso mit Logo (PNG mit Transparenz, JPG, SVG). Ein hochgeladenes Logo wird
im Browser über ein Canvas neu gezeichnet (höchstens 1200 Pixel, PNG oder
JPG in RGB), damit die PDF/A-Datei gültig bleibt. Der Knopf „PDF und XML
zusammen“ packt beide Dateien ohne Kompression in eine ZIP-Datei
(Funktion `zip` in `erzeugen.js`). Die Vorschau zeichnet pdf.js in der
echten Pixeldichte des Bildschirms und zeichnet nach Zoom oder
Größenänderung neu.
Das ZUGFeRD-Logo wird auf dieser Seite bewusst nicht verwendet.
