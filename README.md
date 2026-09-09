# Ru-Rechnungen-Web

Marketing- / Download-Website für **Ru Services – Rechnungsersteller**
(Windows-Programm). Statisches HTML/CSS/JS, kein Build-Schritt, läuft über
GitHub Pages.

Live: <https://finnru007.github.io/Ru-Rechnungen-Web/>

Design nach dem gemeinsamen Regelwerk in
[`Ru-Design/DESIGN.md`](https://github.com/FinnRu007/Ru-Design).

## Struktur

```
index.html          Startseite (Hero, E-Rechnung, Video, Screenshot-Rundgang,
                     Vorteile, Funktionen, Free/Pro, So bekommst du Pro, FAQ)
impressum.html       Impressum (§ 5 DDG)
datenschutz.html     Datenschutzerklärung (DSGVO)
styles.css           komplettes Design (Tokens aus Ru-Design)
script.js            Menü, Screenshot-Lightbox, Platzhalter-Ersatz
img/screenshots/     Programm-Screenshots (siehe README dort)
.nojekyll            liefert die Dateien 1:1 aus
```

## Pflege

- **Screenshots** → PNGs nach `img/screenshots/` legen (Namen siehe
  `img/screenshots/README.md`). Kein Code-Eingriff nötig.
- **Erklärvideo** → in `index.html` im Abschnitt `<!-- ERKLÄRVIDEO EINTRAGEN -->`
  den Platzhalter-`<div>` durch das dort notierte `<iframe>` ersetzen und die
  YouTube-Video-ID einsetzen.
- **Neue Programmversion** → als GitHub-Release in **diesem** Repo
  veröffentlichen, die `.exe` als Asset `Ru-Services-Setup-<version>.exe`
  anhängen. Danach in `index.html` die Versionsnummer und den Download-Link
  (`releases/latest/download/…`) anpassen.
- **Preis / Texte** → direkt in `index.html`.

## Download-Datei

Der Installer wird **nicht** im Repo gespeichert, sondern als Release-Asset.
Der Button auf der Seite zeigt auf
`releases/latest/download/Ru-Services-Setup-4.4.9.exe`.

## Deployment

GitHub Pages: *Settings → Pages* → Branch `main`, Ordner `/` (root).
Jeder Push auf `main` veröffentlicht neu (~30 s).
